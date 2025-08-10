$(function() {
  // Debug logging control
  var DEBUG = false;
  try { DEBUG = (localStorage.getItem('ebtc_debug') === '1'); } catch (e) {}
  var log = {
    info: function() { if (!DEBUG) return; try { console.info.apply(console, arguments); } catch (e) {} },
    warn: function() { try { console.warn.apply(console, arguments); } catch (e) {} },
    error: function() { try { console.error.apply(console, arguments); } catch (e) {} }
  };

  try {
    log.info('[ebay-total-cost] DOM ready. href=%s readyState=%s jQuery=%s', location.href, document.readyState, (window.jQuery && jQuery.fn && jQuery.fn.jquery) || 'missing');
  } catch (e) {
    // no-op
  }

  setTimeout(function() {
    var $ = jQuery;
    var maxPasses = 20; // ~10s with 500ms interval
    var intervalMs = 500;

    function runInjectionPass(passNumber) {
      try {
        log.info('[ebay-total-cost] Injection pass #%d', passNumber);
        var items = $('.s-item, .sresult, .s-card');
        log.info('[ebay-total-cost] Candidate items found: %d', items.length);

        items.each(function(index) {
          try {
            var details = $(this);
            if (details.hasClass('ebtc-processed')) {
              log.info('[ebay-total-cost] #%d already processed, skipping item', index);
              return;
            }
            var $priceNode = details.find('.s-item__price, .lvprice, .s-card__price');
            var $shipNode = details.find('.s-item__logisticsCost, .s-item__shipping, .ship .fee');
            var alreadyInjectedInItem = details.find('.ebay-total-cost').length > 0 || ($priceNode.text() || '').indexOf('(Total Cost:') !== -1;
            if (alreadyInjectedInItem) {
              log.info('[ebay-total-cost] #%d already injected, skipping item', index);
              return;
            }
            var priceText = $priceNode.clone().find('.ebay-total-cost').remove().end().text();
            priceText = priceText.replace(/\(\s*Total\s+Cost:[^)]+\)/i, '');
            var shipText = $shipNode.text();
            if (!shipText) {
              try {
                var $attrRows = details.find('.su-card-container__attributes__primary .s-card__attribute-row');
                var $shipRow = $attrRows.filter(function() {
                  var t = $(this).text() || '';
                  return /delivery|shipping/i.test(t);
                }).first();
                if ($shipRow.length) {
                  shipText = $shipRow.text();
                }
              } catch (ignore) {}
            }
            var priceNum = makeANumber(priceText);
            var shipNum = makeANumber(shipText);
            var totalNum = priceNum + shipNum;
            var totalStr = totalNum.toFixed(2);

            log.info('[ebay-total-cost] #%d priceText="%s" shipText="%s" parsed price=%s ship=%s total=%s', index, priceText, shipText, String(priceNum), String(shipNum), String(totalStr));

            if (totalNum > 0) {
              if (details.find('.ebay-total-cost').length === 0) {
                var injected = false;
                var $totalCostElement = $('<span class="ebay-total-cost">(Total Cost: $' + number_format(totalNum, 2) + ')</span>');
                var $priceRow = $priceNode.closest('.s-card__attribute-row');
                if ($priceRow.length) {
                  // Insert a new attribute row right after the price row
                  var $newRow = $('<div class="s-card__attribute-row"></div>').append($('<span class="su-styled-text secondary large"></span>').append($totalCostElement));
                  $priceRow.after($newRow);
                  log.info('[ebay-total-cost] #%d injected total after price row', index);
                  injected = true;
                } else if ($priceNode.length) {
                  // Fallback: place next to price node
                  $priceNode.after($totalCostElement);
                  log.info('[ebay-total-cost] #%d injected total next to price node', index);
                  injected = true;
                } else {
                  // Try attributes container within s-card
                  var $attrsContainer = details.find('.su-card-container__attributes__primary, .s-card__attributes').first();
                  if ($attrsContainer.length) {
                    var $row = $('<div class="s-card__attribute-row"></div>').append($('<span class="su-styled-text secondary large"></span>').append($totalCostElement));
                    $attrsContainer.append($row);
                    log.info('[ebay-total-cost] #%d injected total into attributes container', index);
                    injected = true;
                  } else {
                    // Last resort: append to item root
                    details.append($totalCostElement);
                    log.info('[ebay-total-cost] #%d injected total at item root', index);
                    injected = true;
                  }
                }
                if (injected) {
                  details.addClass('ebtc-processed');
                }
              } else {
                log.info('[ebay-total-cost] #%d already injected, skipping duplicate', index);
              }
            } else {
              log.info('[ebay-total-cost] #%d skipped injection because total<=0', index);
            }
          } catch (itemErr) {
            log.warn('[ebay-total-cost] Error processing item #%d:', index, itemErr);
          }
        });

        var remaining = 0;
        items.each(function() {
          var $item = $(this);
          var $priceNodeCheck = $item.find('.s-item__price, .lvprice');
          var alreadyInjected = $item.find('.ebay-total-cost').length > 0 || ($priceNodeCheck.text() || '').indexOf('(Total Cost:') !== -1;
          if (!alreadyInjected) remaining++;
        });

        if (items.length === 0 && passNumber < maxPasses) {
          setTimeout(function() { runInjectionPass(passNumber + 1); }, intervalMs);
        } else if (remaining > 0 && passNumber < maxPasses) {
          log.info('[ebay-total-cost] Remaining items without totals: %d — scheduling another pass', remaining);
          setTimeout(function() { runInjectionPass(passNumber + 1); }, intervalMs);
        } else if (remaining === 0) {
          log.info('[ebay-total-cost] All visible items injected — stopping');
        }
      } catch (err) {
        log.error('[ebay-total-cost] Fatal error during injection pass #%d:', passNumber, err);
      }
    }

    runInjectionPass(1);
  }, 100);

  function makeANumber(str) {
    try {
      str = String(str || '');
      str = str.replace(/\(\s*Total\s+Cost:[^)]+\)/ig, '');
      str = str.split('rice')[0];
      str = str.split('Trending')[0];
      var numericMatch = str.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
      var num = numericMatch ? Number(numericMatch[0]) : 0;
      if (!isFinite(num)) num = 0;
      return num;
    } catch (e) {
      log.warn('[ebay-total-cost] makeANumber error for input', str, e);
      return 0;
    }
  }
});


function number_format(number, decimals, dec_point, thousands_sep) {
  // http://kevin.vanzonneveld.net
  // +   original by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
  // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // +     bugfix by: Michael White (http://getsprink.com)
  // +     bugfix by: Benjamin Lupton
  // +     bugfix by: Allan Jensen (http://www.winternet.no)
  // +    revised by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
  // +     bugfix by: Howard Yeend
  // +    revised by: Luke Smith (http://lucassmith.name)
  // +     bugfix by: Diogo Resende
  // +     bugfix by: Rival
  // +      input by: Kheang Hok Chin (http://www.distantia.ca/)
  // +   improved by: davook
  // +   improved by: Brett Zamir (http://brett-zamir.me)
  // +      input by: Jay Klehr
  // +   improved by: Brett Zamir (http://brett-zamir.me)
  // +      input by: Amir Habibi (http://www.residence-mixte.com/)
  // +     bugfix by: Brett Zamir (http://brett-zamir.me)
  // +   improved by: Theriault
  // +   improved by: Drew Noakes
  // *     example 1: number_format(1234.56);
  // *     returns 1: '1,235'
  // *     example 2: number_format(1234.56, 2, ',', ' ');
  // *     returns 2: '1 234,56'
  // *     example 3: number_format(1234.5678, 2, '.', '');
  // *     returns 3: '1234.57'
  // *     example 4: number_format(67, 2, ',', '.');
  // *     returns 4: '67,00'
  // *     example 5: number_format(1000);
  // *     returns 5: '1,000'
  // *     example 6: number_format(67.311, 2);
  // *     returns 6: '67.31'
  // *     example 7: number_format(1000.55, 1);
  // *     returns 7: '1,000.6'
  // *     example 8: number_format(67000, 5, ',', '.');
  // *     returns 8: '67.000,00000'
  // *     example 9: number_format(0.9, 0);
  // *     returns 9: '1'
  // *    example 10: number_format('1.20', 2);
  // *    returns 10: '1.20'
  // *    example 11: number_format('1.20', 4);
  // *    returns 11: '1.2000'
  // *    example 12: number_format('1.2000', 3);
  // *    returns 12: '1.200'
  var n = !isFinite(+number) ? 0 : +number, 
      prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
      sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep,
      dec = (typeof dec_point === 'undefined') ? '.' : dec_point,
      toFixedFix = function (n, prec) {
          // Fix for IE parseFloat(0.55).toFixed(0) = 0;
          var k = Math.pow(10, prec);
          return Math.round(n * k) / k;
      },
      s = (prec ? toFixedFix(n, prec) : Math.round(n)).toString().split('.');
  if (s[0].length > 3) {
      s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
  }
  if ((s[1] || '').length < prec) {
      s[1] = s[1] || '';
      s[1] += new Array(prec - s[1].length + 1).join('0');
  }
  return s.join(dec);
}
