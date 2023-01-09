var payment_form = $('.payment_modal'),
    payment_form_container = payment_form.find('#payment_modal_container'),
    scrollHelper = {
        current_height: null,
        force_current_height: null
    },
    files, // для записи файлов
    grecaptcha = null,
    in_process = false,
    default_rate = {},
    //update_status = null,
    ajax = [];

var paymentMethodsWrap = $('.payment-methods__wrap');


function UpdateStatus() {
    var is_open = false;
    var timer = null;

    this.update = function (new_value) {

        if ($('.requests_output_block > .requests_output_row .requests_data:first').text() === '-') {
            return null;
        }

        new_value = new_value || null;

        if (new_value === null) {
            is_open = !is_open;
        } else {
            is_open = new_value;
        }

        if (is_open && timer === null) {
            timer = setInterval(reloadRequestList, 60000);
        } else if (!is_open && timer !== null) {
            clearInterval(timer);
            timer = null;

            if (ajax['reloadRequestList'] !== undefined) {
                ajax['reloadRequestList'].abort();
            }
        }
    }
}

// TODO: make captcha more usable

$(function () {

    var index_of_way = '';      // Активный способ вывода

    $('.wrap_section').on('click', '.payment_item', function (event) {

        if (in_process) {
            return;
        }

        var block = $(this),
            data = {
                'agent':  undefined,
                'method': undefined,
                'icon':   undefined,
                'other':   [],
            };

        if (block.hasClass('payment_item--disabled')) {
            var message_key = block.data('restrictionmessage');
            if (!message_key) {
                message_key = window.is_deposit ? 'deposit_denied' : 'withdraw_denied';
            }
            alerts(null, dictionary.get(message_key));
            return;
        }

        if (typeof BrowserPayment !== 'undefined' && block.hasClass(BrowserPayment.payment_class)) {
            if (false === BrowserPayment.isAvailable()) {
                alerts(dictionary.get('error'), 'Данный способ оплаты в данный момент невозможен', 0);
                return;
            }
        }

        for (var key in block.data()) {
            if (data.hasOwnProperty(key)) {
                data[key] = block.data(key);
            } else if (key.indexOf('__') === 0) {
                data.other.push(key + '=' + block.data(key));
            }
        }

        if (typeof data.method === 'undefined' || (index_of_way === data.method && block.hasClass('active')) || event.target.className === 'close') {
            return;
        }
        index_of_way = data.method;

        $('.wrap_section .payment_item').removeClass('active');
        block.addClass('active');

        initFormContainer();

        getForm(data.agent, data.method, data.icon, data.other, block);
    });

    $(document).on('input', '.max-number-length', function () {
        var $el = $(this),
            max_length = $el.attr('data-max-number-length'),
            input = $el.val();

        if (input.length >= max_length) {
            $el.val(input.substr(0, max_length));
        }
    });

    //обработчик ввода для карт, помеченных в аттрибуте как card16
    window.card16_mask = '';

  /**
   * @param string regex пример: data-mask-pattern="\+7 \(926\) \d{3}-mytext-\d{2}-\d{2}-\w{2}-\.{2}"
   * @returns {string}
   */
 /* function convertToMaskInput(regex) {
    return new RegExp(regex).source
      .replace(/^\^|\$$/g, '') // чистка служебных начала и конца
      .replace(/\\d/g, '#') // замена цифрофого шаблона на маску цифры
      .replace(/\\w/g, '_') // замена текстового шаблона на маску буквы
      .replace(/\\\./g, '*') // замена универсального шаблона на маску буквы
      .replace(/\\\+/g, '+') // очистка от экранирования знака "+"
      .replace(/\[([^^])*\]/,'_') // замена классификаторов на маску буквы
      .replace(/\(([^)]*)\)\{(\d+)\}/gi, function (_, c, n) { // умножение содержимого скобок и удаление этих скобок
        return Array(+n + 1).join(c)
      })
      // .replace(/(?<!\\)\(([^)]*)(?<!\\)\)/,'$1') // не работает в сафари: удаление скобок (там где нет умножения)
      .replace(/\\\(([^)]*)\\\)/,'[[$1]]') // сафари: вариант обода ретроспективной проверки в сафари: сохраняем
      .replace(/\(([^)]*)\)/,'$1') // сафари: удалем остальное
      .replace(/\[\[([^\]]*)\]\]/,'($1)') // сафари: возвращаем
      .replace(/\\([\\/.(){}[\]])/g, '$1') // очистка экранирования для спец сиволов
      .replace(/([\w*#_.-])\{(\d+)\}/gi, function (_, c, n) {
        return Array(+n + 1).join(c)
      })
  }*/

  function mergeValueMask(value, mask)
  {

    var result = {"value":'', 'offset':0};

    var j = 0;
    for (var i = 0; i < mask.length; i++) {
      if(j >= value.length) break;

      if(mask[i] != value[j] && mask[i] != '#' && mask[i] != '_' && mask[i] != '*'){
        result.value += mask[i];
        result.offset++;
      }else if(mask[i] != value[j]) {
        if (mask[i] == '#') { // цифра
          var founded = false;
          while (j < value.length) {
            if (!isNaN(parseInt(value[j]))) {
              founded = true;
              break;
            }
            j++;
          }
          if (!founded) break;
        } else if (mask[i] == '_' && !isNaN(parseInt(value[j]))) {
          var founded = false;
          while (j < value.length) {
            if (isNaN(parseInt(value[j]))) {
              founded = true;
              break;
            }
            j++;
          }
          if (!founded) break;
        }

        result.offset++;
        result.value += value[j++];
      }else if(mask[i] == value[j]) {
        result.offset++;
        result.value += value[j++];
      }
    }

    if(result.value.length < mask.length)
    {
      // законментирован код который курсор ставит на послледнее м
      // есто перед вводимым символом - но это не позволяет удобно удалить
      // символы назад поэтому пока закоментил.

      // var stop = false;
      // var specials = ['#','_','*'];
      for(var i = result.value.length; i < mask.length; i++)
      {
        // if(specials.indexOf(mask[i]) != -1)
        // {
        //   stop = true;
        // }
        // if(!stop){
        //   result.offset++;
        // }
        result.value += mask[i].replace(/^[#*_]{1}$/,'_');
      }
    }
    return result;
  }

  $(document).on('input', '[data-mask-pattern]', function (event) {
    var $el = $(this),
      el = $el[0],
      pattern = $el.data('mask-pattern'),
      text = $el.val(),
      cursor_position = el.selectionStart,
      hide_if_change = $el.data('mask-pattern-hide') || true;

    cursor_position = cursor_position || text.length; // при загрузке дефолтного значение выделение на 0 позиции
    if(!pattern) return;

    if(hide_if_change) text = text.substr(0, cursor_position);
    var mask = convertToMaskInput(pattern);
    var result = mergeValueMask(text, mask, cursor_position);
    $el.val(result.value);
    cursor_position = result.offset;
    el.setSelectionRange(cursor_position, cursor_position);
  });

    $(document).on('input', '[data-mask="card16"]', function () {
        var $el = $(this),
            input = $el.val(),
            input_position = $el[0].selectionStart,
            result = '',
            changed_symbol = '',
            correct_cursor_pos = 0;

        for (var j = 0; j < input.length; j++) {
            if (window.card16_mask[j] !== input[j]) {
                changed_symbol = window.card16_mask[j];
                break;
            }
        }

        if (changed_symbol === ' ' && input.length < window.card16_mask.length) {
            input = input.substr(0, input_position - 1) + input.substr(input_position);
            correct_cursor_pos = -2;
        }

        for (var i = 0; i < input.length; i++) {
            var int_val = parseInt(input[i]);
            if ((!int_val && int_val !== 0) || result.length > 18) {
                continue;
            }

            result += ([4, 9, 14].indexOf(result.length) !== -1 ? ' ' : '') + input[i];
        }

        $el.val(window.card16_mask = result);

        var cursor_position = (result.length > input.length ? input_position + 1 : input_position) + correct_cursor_pos;
        $el[0].setSelectionRange(cursor_position, cursor_position);
    });

    $(".btn_payment_method").click(function () {
        $(this).toggleClass('btn_payment_method--is-toggled');
        $(this).siblings('aside').find('.aside_wrap').addClass('scrollbar-inner').scrollbar();
        $("aside").toggleClass('active');
        $('.fon_modal').toggleClass('active');
    });

    $(document).on('click', '#deposit_button', function (e) {
        var $this = $(this);

        e.preventDefault();

        if (grecaptcha !== null) {
            createDeposit($this);
            
        } else {
            grecaptcha.execute();
        }
    }).on('click', '#withdraw_button', function (e) {
        var $this = $(this);

        e.preventDefault();

        if (grecaptcha !== null) {
            grecaptcha.execute();
        } else {
            createWithdraw($this);
        }
    }).on('click', '.payment_modal .close', function (event) {
        event.preventDefault();

        closeForm();
    }).on('click', 'aside .close', function(e) {
        $('aside').removeClass('active');
        $('.fon_modal').removeClass('active');
    });

    $('.fon_modal').on('click', function (event) {

        if (in_process) {
            return;
        }

        event.preventDefault();

        closeForm();

        $("aside").removeClass('active');
        $('.btn_payment_method').removeClass('btn_payment_method--is-toggled');
    });

    $(window).resize(function () {
        if (payment_form.length > 0) {
            payment_form.removeClass('full');
            removeFullIframe();
            payment_form.css('height', 'auto');
            if (payment_form.hasClass('active')) {
                getOffsetForm(payment_form);
            }
        }
        resize();
    });

    var $show_all_btn = $('.without_geo_output-js'),
        type_code = $('.confirmation');

    if ($('.payment_wrap .payment_item').filter(':hidden').length <= 0) {
        $show_all_btn.remove();
    }

    var params = window.parent.location.href.split('?');

    if (params.length > 1) {
        var get_param_str = params[1].split('&'),
            get_param = {};

        get_param_str.forEach(function (param) {
            var data = param.split('=');
            if (data.length > 1) {
                get_param[data[0]] = data[1];
            }
        });

        if (get_param['form']) {
            var $element = $('.' + get_param['form']);

            $element.length && $element.trigger('click');
        }
    }

    if ($show_all_btn.length) {
        $show_all_btn.on('tap click', function (event) {
            event.preventDefault();

            $switch = $(this);
            $switch.toggleClass('active');
            if (!$switch.hasClass('active')) {
                $('.payment_wrap .payment_item').show();
                $('.aside_row').each(function (inx, elm) {
                    var number_elements_in_cat = $(elm).find('.number_payment_system');
                    number_elements_in_cat.text(number_elements_in_cat.data('all_count'));
                });
            } else {

                if ($('.aside_row.active .number_payment_system').is('[data-geo_count=0]')) {
                    $('.aside_row:first').click();
                }

                $('.payment_wrap .payment_item.is_geo').hide();
                $('.aside_row').each(function (inx, elm) {
                    var number_elements_in_cat = $(elm).find('.number_payment_system');
                    number_elements_in_cat.text(number_elements_in_cat.data('geo_count'));
                });
            }


            showHideZeroItemMenu();
            showPaymentType();
            resize();
        });
    }

    if (type_code.length) {
        $('.confirmation_switch_item').on('click', function () {
            if ($(this).hasClass('active')) {
                return;
            }
            $('.confirmation_switch_item').removeClass('active');
            $(this).addClass('active');
        });
    }


    $('.requests_output_block').on('click', '.update_status', function (e) {
        e.preventDefault();
        reloadRequestList();
    });

    $(document).on('change keyup input click', 'input[data-filter-pattern]', function () {

        var pattern = $(this).data('filter-pattern');

        if (!pattern) {
            return;
        }

        var re = new RegExp(pattern, 'g');

        if (this.value.match(re)) {
            this.value = this.value.replace(re, '');
        }
    }).off('change keyup input click select touchstart touchmove', 'input[name="amount"]').on('change keyup input click select touchstart touchmove', 'input[name="amount"]', function () {
        var $rate = $('#crypto_conversion_rate'),
            amount = parseFloat($(this).val()),
            base_rate = parseFloat($rate.attr('data-base-rate'));

        if (isNaN(amount)) {
            amount = 0;
        }

        if (typeof default_rate[index_of_way] === "undefined" && base_rate) {
            default_rate[index_of_way] = base_rate;
        }

        $rate.text((amount * default_rate[index_of_way]).toFixed(2));
    }).on('click', '#copy_wallet_btn', function () {
        var el = document.getElementById('crypto_wallet');
        var range = document.createRange();
        var sel = window.getSelection();

        var copiedText = $('#copy_wallet_btn_text');
        copiedText.show().delay(2000).hide(500);

        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);

        document.execCommand('copy');

        sel.removeAllRanges();
        return false;
    }).on('click', '.copy_content_btn', function () {
        var contentElement = this.previousSibling;
        var range = document.createRange();
        var sel = window.getSelection();

        var copiedText = $(this.nextSibling);
        copiedText.show().delay(2000).hide(500);

        range.selectNodeContents(contentElement);
        sel.removeAllRanges();
        sel.addRange(range);

        document.execCommand('copy');

        sel.removeAllRanges();
        return false;
    }).on('click', '.requests_output_block-close', function () {
        $('.requests_output_block').slideToggle();
        $('.requests_output-js').removeClass('open_list');
    });

    if ($('.requests_output-js').length > 0) {
        update_status = new UpdateStatus();

        $(".requests_output-js").click(function () {

            if (update_status !== null) {
                update_status.update();
            }

            $('.requests_output_block').slideToggle();
            $(this).toggleClass('open_list');

            if ($(this).hasClass('open_list')) {
                reloadRequestList();
            }
        });
    }
    if ($(".requests_output-js").length > 0) {
        $(".requests_output-js").click(function () {
            $(this).next(".requests_output_block").slideToggle();
            $(this).toggleClass("open_list");
        });
    }



    ellipsizeTextBox('payment-cell-name__caption');

    $('.aside_row').click(function () {

        $active = $(this);
        $toggleButton = $('.btn_payment_method');
        if ($active.is('.active')) {
            return;
        }

        $('.aside_row.active').removeClass('active');
        $toggleButton.removeClass('btn_payment_method--is-toggled');
        $active.addClass('active');
        $toggleButton.addClass('btn_payment_method--is-toggled');
        showPaymentType($active.data('type'));
        resize();

        if ($('#payment_methods').is('.mobi')) {
            $("aside").removeClass('active');
            $toggleButton.removeClass('btn_payment_method--is-toggled');
            $('.fon_modal').removeClass('active');
        }
    });
    showHideZeroItemMenu()

    if (isInFrame()) {
        $(parent.window).scroll(function () {
            if (payment_form.length > 0) {
                if (payment_form.hasClass('active')) {
                    if (!isTest()) {
                        getOffsetForm(payment_form);
                    }
                }
            }
        });
    }

    if ($('.owl-carousel img').length) {
        $('.owl-carousel').owlCarousel({
            loop: false,
            margin: 15,
            nav: true,
            items: 1,
            autoplay: true,
            autoplayTimeout: 3000,
            autoplayHoverPause: true
        });
    }
});

function showPaymentType(type) {

    type = type || $('.aside_row.active').data('type');

    if (type === 'all_systems') {
        $('.group_item:not(.not-visible-now)').show();
    } else {
        $('.group_item').hide();
        $('#group_' + type).show();
    }
}

function showHideZeroItemMenu() {

    $('.number_payment_system').each(function (i, item) {
        $parent = $(this).parent();
        if ($(this).text() === '0') {
            $parent.hide();
            $('#group_' + $parent.data('type')).addClass('not-visible-now').hide();
        } else {
            $parent.show();
            $('#group_' + $parent.data('type')).removeClass('not-visible-now').show();
        }
    });
}

function initFormContainer() {
    if (payment_form_container.length > 0) {
        if (payment_form.hasClass('full')) {
            payment_form.removeClass('full');
            removeFullIframe();
        }

        payment_form_container.html('');
        paymentMethodsWrap.removeClass('payment-methods__wrap--hidden');
    } else {
        $('.fon_modal').after(
            $('<div/>', {'class': 'payment_modal modal-payment'}).append(
                $('<span/>', {'class': 'close modal-payment__close'}),
                $('<div/>', {'id': 'payment_modal_container', 'class': 'modal-payment__container modal-payment-container'})
            )
        );
        payment_form = $('.payment_modal');
        payment_form_container = payment_form.find('#payment_modal_container');
        paymentMethodsWrap = $('.payment-methods__wrap');
    }
}

// после двух строк обрезаем текст и ставим троеточие
function ellipsizeTextBox(className, inInfo = false) {
    var el = document.getElementsByClassName(className);
    for (var i = 0; i < el.length; i++) {
        var wordArray = el[i].innerHTML.trim().split(' ');
        el[i].setAttribute('title', el[i].innerHTML);
        if ((el[i].scrollHeight > 0 && el[i].scrollHeight > (el[i].parentElement.clientHeight - 6) && wordArray.length > 1) || (el[i].scrollHeight > 40 && inInfo)) {
            wordArray.splice(-2, 2);
            el[i].innerHTML = wordArray.join(' ') + '...';
        }
    }
}

function getForm(agent, subsystem, icon, add_data, block) {

    grecaptcha = null;
    files = null;

    var url = '/' + window.location.pathname
            .split('/')
            .filter(function (item) {
                if (item !== '') {
                    return item;
                }
            })
            .join('/') + '/' + agent + '/',
        $preloader = $('.preloader'),
        param_request = [];

    if (typeof add_data !== 'undefined') {
        param_request = add_data;
    }

    if (block) {
        var method = block.data('rawmethod');

        if (method !== '') {
            param_request.push('method=' + method);
        }
    }

    if (subsystem !== '') {
        param_request.push('sub_system=' + subsystem);
    }

    if (typeof icon !== 'undefined') {
        param_request.push('icon=' + icon);
    }

    if (payment_form_container.find('form').length) {
        param_request.push(payment_form_container.find('form').serialize());
    } else {
        //$('li .dynamic_payment_form .container_body').html('');
    }

    $.ajax({
        url: url,
        type: 'POST',
        data: param_request.join('&'),
        dataType: 'json',
        beforeSend: function () {
            //$this.hide();
            //$preloader.show();
            $('.fon_modal').addClass('active');
            $('.payment-methods__wrap').addClass('payment-methods__wrap--hidden');
            if (isInFrame() && window.user_id === 335676453) {
                resize();
                parent.window.scrollTo({ top: 0})
            }
            $("#before_preloader").show();
            in_process = true;
        },
        success: function (data) {

            $('.fon_modal').removeClass('active');

            if (data.success) {

                if (data['code'] === 6) {
                    alerts(dictionary.get('confirm_action'), data['message'], data['code'], data);
                }

                if (data['code'] === 5) {

                    if (agent === 'redirector') {
                        in_process = false;
                        closeForm();
                    }

                    window.parent.location.href = data['url'];
                    return;
                }

                if (data['code'] === 1 || data['code'] === 8) {
                    closeForm();
                    alerts(data['title'], data['message'], 0);
                    return;
                }

                if (data['code'] === 4) {

                    closeForm();

                    var add_data = [];
                    if (typeof data['amount'] !== 'undefined' && data['amount']) {
                        add_data.push('amount=' + data['amount']);
                    }
                    if (typeof data['bank'] !== 'undefined' && data['bank']) {
                        add_data.push('bank=' + data['bank']);
                    }
                    if (typeof data['bank_code'] !== 'undefined' && data['bank_code']) {
                        add_data.push('bank_code=' + data['bank_code']);
                    }

                    getForm(data['agent'], data['method'], null, add_data, block);
                    return;
                }

                //if (!payment_form.hasClass('active')) {
                $('.fon_modal').addClass('active');
                payment_form.addClass('active').show();
                //}

                payment_form_container.html(data.html);
                paymentMethodsWrap.addClass('payment-methods__wrap--hidden');
                if (isInFrame() && window.user_id === 335676453) {
                    resize();
                }

                getOffsetForm(payment_form);

                if (typeof VKI_attach !== 'undefined') {
                    refreshKeybords();
                }

                //helper_form.get(agent, subsystem);
            } else {

                if (typeof data['message'] === 'undefined' || !data['message']) {
                    data['title'] = dictionary.get('error');
                    data['message'] = dictionary.get('unknown_error');
                }
                closeForm();
                alerts(dictionary.get('error'), data['message'], 0);
            }
        },
        complete: function () {
            $("#before_preloader").hide();
            in_process = false;
            $("input[data-mask-pattern]").trigger('input');
        }
    });
}

function isTest() {
    var isMobiVersion =  $('#payment_methods').is('.mobi');
    var checkOuterHeight = true;
    if (window.outerHeight == 0) {
        checkOuterHeight = false
    }
    return isMobiVersion && checkOuterHeight;
}

function getOffsetForm(form) {
    $('#amount').on('input', function ($event) {
        var value = $event.target.value;
        $event.target.value = value.replaceAll(',', '.');
    });

    if (isTest()) {
        var getWindowHeight = window.outerHeight;
        var getHeightPopup = document.getElementById('payment_modal_container').offsetHeight;

        var getTopIframe = 0;
        var getHeightParentBody = 0;
        var getHeightFrame = document.body.getBoundingClientRect().height;
        var getScrollParent = 0;
        var getTopGutter = 0;

        if (isInFrame()) {
            getTopIframe = window.parent.document.getElementById('payments_frame').getBoundingClientRect().top;
            getHeightFrame = window.parent.document.getElementById('payments_frame').getBoundingClientRect().height;
            getHeightParentBody = window.parent.document.body.getBoundingClientRect().height;
            getScrollParent = window.parent.scrollY;
            getTopGutter = getScrollParent + getTopIframe;
        }

        var getHeightFooter = getHeightParentBody - getHeightFrame - getTopGutter;
        var getTopStyles = getWindowHeight / 2 - getHeightPopup / 2 - getTopIframe;
        var getTopStylesFixHeight = getWindowHeight / 2 - getWindowHeight / 2 - getTopIframe;

        if (getTopStyles + getHeightPopup + getHeightFooter + getTopGutter < getHeightParentBody) {
            if (getHeightPopup + 50 > getWindowHeight) {
                if (getTopStyles < 0) {
                    form.css({'top': 0, 'bottom': 'auto', 'height': getWindowHeight - 70 + 'px'});
                } else {
                    form.css({'top': getTopStylesFixHeight + 60  + 'px', 'bottom': 'auto', 'height': getWindowHeight - 70 + 'px'});
                }
            } else {
                if (getTopStyles < getTopGutter - getWindowHeight - getHeightPopup || getTopStyles < 0) {
                    form.css({'top': 0, 'bottom': 'auto', 'height': 'auto'});
                } else {
                    form.css({'top': getTopStyles + 'px', 'bottom': 'auto', 'height': 'auto'});
                }
            }
        } else {
            form.css({'top': 'auto', 'bottom': 0, 'height': 'auto'});
        }

    } else {
        var h = form.height(),
            h_window = $(window).height(),
            h_win = h_window,
            offset_top = 0,
            actual_height = document.getElementsByTagName('body')[0].children[0].scrollHeight + 50,
            marginTop = 0,
            is_mobi = $('#payment_methods').is('.mobi'),
            full = false,
            h_delta = 70,
            offset_delta = 50;

        if (getQueryVariable('fast_reg') === '1') {
            h_delta = 500;
            offset_delta = 200;

            if (is_mobi) {
                full = true;
            }
        }

        if (scrollHelper.current_height) {
            actual_height = scrollHelper.current_height;
        }

        if (isInFrame()) {
            h_win = parent.window.innerHeight;
            offset_top = parent.window.pageYOffset;

            h_win = h_win - h_delta; // исключаем шапку для большого окна
            if (is_mobi) {
                if (scrollHelper.current_height === null) {
                    offset_top = offset_top - 70;
                }
            } else {
                offset_top = offset_top - offset_delta;
            }

            if (actual_height >= h_win) {
                marginTop = offset_top + (h_win - h) / 2;
            } else {
                marginTop = offset_top + (actual_height - h) / 2;
            }
        } else {
            marginTop = offset_top + (h_win - h) / 2;
        }

        if ((isInFrame() && h >= h_win) || (h >= h_window) || scrollHelper.current_height) {
            full = true;
            if (!is_mobi) {
                marginTop = offset_top;
            }
        }

        if ((marginTop + h) > actual_height) {
            marginTop = actual_height - h;
        }

        if (marginTop < 0 || (is_mobi && h >= h_win)) {
            marginTop = 0;
        }

        if (is_mobi && offset_top >= 70 && scrollHelper.current_height === null) {
            marginTop = offset_top;
        }

        if (is_mobi && full && scrollHelper.current_height > 0) {
            marginTop = 0;
        }

        if (!full) {
            form.css({'top': 0, 'margin-top': marginTop});
        } else {
            if (is_mobi) {
                form.css({'height': h_win, 'top': 0, 'margin-top': marginTop});
            } else {
                if (isInFrame() && h_win < h_window) {
                    h_window = h_win;
                }
                form.css({'height': h_window, 'top': 0, 'margin-top': marginTop});
            }
            form.addClass('full');
            addFullIframe();
            if (!is_mobi) {
                payment_form_container.addClass('scrollbar-inner').scrollbar();
            }
        }

        if (scrollHelper.force_current_height) {
            scrollHelper.current_height = scrollHelper.force_current_height;
            resize();
        } else if (is_mobi && h > h_win && scrollHelper.current_height === null) {
            scrollHelper.current_height = h_win + 50;
            resize();
        } else if (is_mobi && h >= h_win && scrollHelper.current_height > 0) {
            scrollHelper.current_height = h + 50;
            resize();
        }

        var $s2 = $(".select2-container");

        if ($s2.eq(1).length) {
            if ($s2.eq(1).find("span").is(".select2-dropdown--below")) {
                $s2.eq(1).css("top", $s2.offset().top + $s2.height());
            } else if ($s2.eq(1).find("span").is(".select2-dropdown--above")) {
                $s2.eq(1).css("top", $s2.offset().top - $s2.eq(1).find("span").height());
            }
        }
    }
}

function createDepositRecaptcha() {
    createDeposit($('#deposit_button'));
}

function createWithdrawRecaptcha() {
    createWithdraw($('#withdraw_button'));
}

function createDeposit($this) {
    var $form = $this.closest('form'),
        payment_system = $('.payment_item.active'),
        subsystem = payment_system.data('method'),
        rewriteMethod = $this.data('rewrite-method'),
        button_key = payment_system.data('rawmethod'),
        type = payment_system.data('type'),
        $container = $form.parent(),
        $preloader = $('.preloader'),
        url = $form.attr('action'),
        formData = {},
        contentType = false,
        processData = false;

    if(rewriteMethod)
    {
      subsystem = rewriteMethod;
    }

    if (typeof files !== 'undefined' && files) {
        formData = new FormData($form.get(0));

        if (subsystem !== '') {
            formData.append('sub_system', subsystem);
        }

        formData.append('payment_system_type', type);
    } else {
        var form_serialize = $form.serializeArray();

        $(form_serialize).each(function (key, value) {
            formData[value['name']] = value['value'];
        });

        if (subsystem !== '') {
            formData['sub_system'] = subsystem;
        }

        formData['payment_system_type'] = type;
        formData['button_key']          = button_key;

        if (window.s_id) {
            formData['s_id'] = window.s_id;
        }

        processData = true;
        contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
    }

    $('.payment_modal_error').empty();

    var is_popup = false;

    ajax['createDeposit'] = $.ajax({
        url: url,
        type: 'post',
        data: formData,
        //async: false,
        contentType: contentType, // важно - убираем форматирование данных по умолчанию
        processData: processData, // важно - убираем преобразование строк по умолчанию
        beforeSend: function () {
            $this.hide();
            $preloader.show();
            in_process = true;
        },
        success: function (data) {
            $(document).trigger('deposit.request_complete', data);
            var forms;
            if (data['success']) {

                if (data['code'] === 3) {
                    $this.show();
                    $preloader.hide();

                    // alerts(data['title'], data['message'], 2);
                    if (data['fields'] && typeof data['fields'] !== 'undefined') {
                        for (var field in data['fields']) {
                            addFieldToForm($this, data['fields'][field]);
                            if (data['message'] !== '') {
                                $('#payment_error_' + data['fields'][field]['name']).text(data['message']);
                            }
                        }
                        getOffsetForm(payment_form);
                    }

                    if (typeof VKI_attach !== 'undefined') {
                        refreshKeybords();
                    }

                } else if (data['code'] === 1) {

                    closeForm();
                    alerts(data['title'], data['message'], 0);

                } else if (data['code'] === 2) {
                    $this.show();
                    $preloader.hide();

                    if (typeof data['fields'] !== 'undefined' && data['fields']) {
                        for (var field_name in data['fields']) {
                            $('#payment_error_' + field_name).text(data['fields'][field_name]);
                        }
                    }
                    getOffsetForm(payment_form);

                    if (grecaptcha !== null) {
                        grecaptcha.reset();
                    }

                    //alerts(data['title'], data['message'], 0);
                } else if (data['code'] === 6) {
                    alerts(dictionary.get('confirm_action'), data['message'], data['code'], data);
                } else if (data['code'] === 4) {

                    closeForm();

                    var add_data = [];
                    if (typeof data['amount'] !== 'undefined' && data['amount']) {
                        add_data.push('amount=' + data['amount']);
                    }
                    if (typeof data['bank'] !== 'undefined' && data['bank']) {
                        add_data.push('bank=' + data['bank']);
                    }
                    if (typeof data['bank_code'] !== 'undefined' && data['bank_code']) {
                        add_data.push('bank_code=' + data['bank_code']);
                    }

                    getForm(data['agent'], data['method'], null, add_data, $this);
                } else if (data['code'] === 9) {
                    if (data['message']) {
                        var queue_data = data['message'].split(':');
                        var trn_id     = queue_data[0];
                        var period     = queue_data[1];
                        var paysystem  = queue_data[2];
                        var sub_system = queue_data[3];

                        if (trn_id && period) {
                            $('.preloader').show();
                            document.addEventListener('request_queue_done', function (event) {
                                onDepositAnswer(
                                    event.data,
                                    $this,
                                    is_popup
                                );
                            });
                            checkRequestStatus(trn_id, period, paysystem, sub_system);
                        }
                    }
                } else {
                    cacheReload();
                    $container.html(data['html']);

                    forms = $container.find('form');
                    if (forms.length > 0 && !forms.hasClass('no-auto-submit')) {
                        if (forms.attr('target') === '_blank') {
                            if(forms.attr('method') === 'get') {
                                addQueryStringAsHidden(forms);
                            }
                            is_popup = true;
                        } else {
                            forms.submit();
                        }
                    } else {
                        $preloader.hide();
                    }
                    getOffsetForm(payment_form);

                    if ($('.response_wrapper', $container).hasClass('wide_screen')) {
                        payment_form.addClass('full');
                    }
                }
            } else {
                if (data['ga']) {
                    //sendAnalyticsData('Ошибки пополнения', data['ga'], 'ВСТАВИТЬ НАЗВАНИЕ МЕТОДА');
                }
                if (typeof data['message'] === 'undefined' || !data['message']) {
                    data['title'] = dictionary.get('error');
                    data['message'] = dictionary.get('unknown_error');
                }

                if (typeof data['fields'] !== 'undefined' && data['fields']) {
                    for (var field_name in data['fields']) {
                        $('#payment_error_' + field_name).text(data['fields'][field_name]);
                    }
                    getOffsetForm(payment_form);
                    $preloader.hide();
                    $this.show();
                    return;
                }

                closeForm();
                alerts(data['title'], data['message'], 0);
            }

            if (is_popup) {
                $container.find('form').submit();
                in_process = false;
                closeForm();// TODO: if window was block, then we don't see help message from create_form
                parent.postMessage('close payment modal', '*');
            }
        },
        error: function () {
            $this.show();
            $preloader.hide();
            in_process = false;
        },
        complete: function () {
            in_process = false;
        }
    });
}
function addQueryStringAsHidden(form){
    if (form.attr("action") === undefined){
        throw "form does not have action attribute"
    }

    let url = form.attr("action");
    if (url.includes("?") === false) return false;

    let index = url.indexOf("?");
    let action = url.slice(0, index)
    let params = url.slice(index);
    url = new URLSearchParams(params);
    for (param of url.keys()){
        let paramValue = url.get(param);
        let attrObject = {"type":"hidden", "name":param, "value":paramValue};
        let hidden = $("<input>").attr(attrObject);
        form.append(hidden);
    }
    form.attr("action", action)
}

function onDepositAnswer(
    data,
    $this,
    is_popup
) {
    var $form = $this.closest('form'),
        $preloader = $('.preloader'),
        $container = $form.parent();

    $(document).trigger('deposit.request_complete', data);
    var forms;
    if (data['success']) {

        if (data['code'] === 3) {
            $this.show();
            $preloader.hide();

            // alerts(data['title'], data['message'], 2);
            if (data['fields'] && typeof data['fields'] !== 'undefined') {
                for (var field in data['fields']) {
                    addFieldToForm($this, data['fields'][field]);
                    if (data['message'] !== '') {
                        $('#payment_error_' + data['fields'][field]['name']).text(data['message']);
                    }
                }
                getOffsetForm(payment_form);
            }

            if (typeof VKI_attach !== 'undefined') {
                refreshKeybords();
            }

        } else if (data['code'] === 1) {

            closeForm();
            alerts(data['title'], data['message'], 0);

        } else if (data['code'] === 2) {
            $this.show();
            $preloader.hide();

            if (typeof data['fields'] !== 'undefined' && data['fields']) {
                for (var field_name in data['fields']) {
                    $('#payment_error_' + field_name).text(data['fields'][field_name]);
                }
            }
            getOffsetForm(payment_form);

            if (grecaptcha !== null) {
                grecaptcha.reset();
            }

            //alerts(data['title'], data['message'], 0);
        } else if (data['code'] === 6) {
            alerts(dictionary.get('confirm_action'), data['message'], data['code'], data);
        } else if (data['code'] === 4) {

            closeForm();

            var add_data = [];
            if (typeof data['amount'] !== 'undefined' && data['amount']) {
                add_data.push('amount=' + data['amount']);
            }
            if (typeof data['bank'] !== 'undefined' && data['bank']) {
                add_data.push('bank=' + data['bank']);
            }
            if (typeof data['bank_code'] !== 'undefined' && data['bank_code']) {
                add_data.push('bank_code=' + data['bank_code']);
            }

            getForm(data['agent'], data['method'], null, add_data, $this);
        } else if (data['code'] === 9) {
            if (data['message']) {
                var queue_data = data['message'].split(':');
                var trn_id     = queue_data[0];
                var period     = queue_data[1];
                var paysystem  = queue_data[2];
                var sub_system = queue_data[3];

                if (trn_id && period) {
                    $('.preloader').show();
                    document.addEventListener('request_queue_done', function (event) {
                        onDepositAnswer(
                            event.data,
                            $this,
                            is_popup
                        );
                    }, {once: true});
                    checkRequestStatus(trn_id, period, paysystem, sub_system);
                }
            }
        } else {
            $container.html(data['html']);

            forms = $container.find('form');
            if (forms.length > 0 && !forms.hasClass('no-auto-submit')) {
                if (forms.attr('target') === '_blank') {
                    if(forms.attr('method') === 'get') {
                        addQueryStringAsHidden(forms);
                    }
                    is_popup = true;
                } else {
                    forms.submit();
                }
            } else {
                $preloader.hide();
            }
            getOffsetForm(payment_form);

            if ($('.response_wrapper', $container).hasClass('wide_screen')) {
                payment_form.addClass('full');
            }
        }
    } else {
        if (data['ga']) {
            //sendAnalyticsData('Ошибки пополнения', data['ga'], 'ВСТАВИТЬ НАЗВАНИЕ МЕТОДА');
        }
        if (typeof data['message'] === 'undefined' || !data['message']) {
            data['title'] = dictionary.get('error');
            data['message'] = dictionary.get('unknown_error');
        }

        if (typeof data['fields'] !== 'undefined' && data['fields']) {
            for (var field_name in data['fields']) {
                $('#payment_error_' + field_name).text(data['fields'][field_name]);
            }
            getOffsetForm(payment_form);
            return;
        }

        closeForm();
        alerts(data['title'], data['message'], 0);
    }

    if (is_popup) {
        $container.find('form').submit();
        closeForm();// TODO: if window was block, then we don't see help message from create_form
    }
}

function createWithdraw($this) {
    var $form = $this.closest('form'),
        $container = $form.parent(),
        payment_system = $('.payment_item.active'),
        type = payment_system.data('type'),
        subsystem = payment_system.data('method'),
        rewriteMethod = $this.data('rewrite-method'),
        button_key = payment_system.data('rawmethod'),
        $preloader = $('.preloader'),
        url = $form.attr('action'),
        conf_type = $('.confirmation_switch_item.active').data('type'),
        param_request = [],
        formData = {},
        contentType = false,
        processData = false;

    if(rewriteMethod)
    {
      subsystem = rewriteMethod;
    }

    if (typeof files !== 'undefined' && files) {
        formData = new FormData($form.get(0));

        if (subsystem !== '') {
            formData.append('sub_system', subsystem);
        }

        if (typeof conf_type !== 'undefined' && conf_type) {
            formData.append('confirmation_type', conf_type);
        }
    } else {
        var form_serialize = $form.serializeArray();

        $(form_serialize).each(function (key, value) {
            formData[value['name']] = value['value'];
        });

        if (subsystem !== '') {
            formData['sub_system'] = subsystem;
        }

        if (typeof conf_type !== 'undefined' && conf_type) {
            formData['confirmation_type'] = conf_type;
        }

        formData['payment_system_type'] = type;
        formData['button_key']          = button_key;

        if (window.s_id) {
            formData['s_id'] = window.s_id;
        }

        processData = true;
        contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
    }

    $('.payment_modal_error').empty();

    var response_event = new Event('withdraw_response');

    $.ajax({
        url: url,
        type: 'post',
        contentType: contentType, // важно - убираем форматирование данных по умолчанию
        processData: processData, // важно - убираем преобразование строк по умолчанию
        data: formData,
        beforeSend: function () {
            $this.hide();
            $preloader.show();
        },
        success: function (data) {
            $this.show();
            $preloader.hide();

            document.dispatchEvent(response_event);

            if (data['success']) {

                if (data['code'] === 3) {
                    // alerts(data['title'], data['message'], 2);
                    if (data['fields'] && typeof data['fields'] !== 'undefined') {
                        for (var field in data['fields']) {
                            addFieldToForm($this, data['fields'][field]);
                            if (data['message'] !== '' && data['fields'][field].type === 'text') {
                                $('#payment_error_' + data['fields'][field]['name']).text(data['message']);
                            }
                        }
                        getOffsetForm(payment_form);
                    }

                    if (typeof VKI_attach !== 'undefined') {
                        refreshKeybords();
                    }

                } else if (data['code'] === 4) {

                    closeForm();

                    getForm(data['agent'], data['method'], data['icon'], [], $this);

                } else if (data['code'] === 6) {
                    closeSocket();
                    alerts(dictionary.get('confirm_action'), data['message'], data['code'], data);
                } else if (data['code'] === 2) {

                    if (typeof data['fields'] !== 'undefined' && data['fields']) {
                        for (var field_name in data['fields']) {
                            $('#payment_error_' + field_name).text(data['fields'][field_name]);
                        }
                    }

                    getOffsetForm(payment_form);

                    if (grecaptcha !== null) {
                        grecaptcha.reset();
                    }

                    //alerts(data['title'], data['message'], 0);
                } else if (data['code'] === 5) {
                    closeSocket();
                    window.parent.location.href = data['message'];
                } else if (data['code'] === 3) {
                    // alerts(data['title'], data['message'], 2);
                    if (data['fields']) {
                        for (var field in data['fields']) {
                            addFieldToForm($this, data['fields'][field]);
                            if (data['message'] !== '' && data['fields'][field].type === 'text') {
                                $('#payment_error_' + data['fields'][field]['name']).text(data['message']);
                            }
                        }
                        getOffsetForm(payment_form);
                    }

                    if (typeof VKI_attach !== 'undefined') {
                        refreshKeybords();
                    }

                } else if (data['code'] === 12) {

                    if (data['fields'] && typeof data['fields'] !== 'undefined') {
                        for (var field in data['fields']) {
                            addFieldToForm($this, data['fields'][field]);
                        }
                        getOffsetForm(payment_form);
                    }
                }

                else {
                    if (data['data']) {
                        parent.postMessage({order_info: data['data']}, window['location']['origin']);
                    }

                    closeSocket();
                    closeForm();
                    reloadRequestList();
                    alerts(data['title'], data['message'], data['code']);
                }

            } else {
                if (data['ga']) {
                    //sendAnalyticsData('Ошибки пополнения', data['ga'], 'ВСТАВИТЬ НАЗВАНИЕ МЕТОДА');
                }
                if (typeof data['message'] === 'undefined' || !data['message']) {
                    data['title'] = dictionary.get('error');
                    data['message'] = dictionary.get('unknown_error');
                }

                if (typeof data['fields'] !== 'undefined' && data['fields']) {
                    for (var field_name in data['fields']) {
                        $('#payment_error_' + field_name).text(data['fields'][field_name]);
                    }
                    getOffsetForm(payment_form);
                    return;
                }

                closeSocket();
                closeForm();
                reloadRequestList();
                alerts(data['title'], data['message'], 0);
            }
        },
        error: function () {
            closeSocket();
            document.dispatchEvent(response_event);
            $this.show();
            $preloader.hide();
        }
    });
}

function addFieldToForm(link_to_button, field) {

    var input_field = $('<input/>'),
        error_block = $('<div/>', {
            'class': 'payment_modal_error',
            'id': 'payment_error_' + field['name']
        });

    if (field['view'] === 'html') {
        input_field = $('<div/>', {text: field['value']});
    } else if (field['view'] === 'true_html') {
        link_to_button.before(
            $('<div/>', {class: 'payment_modal_row'})
                .append($('<div/>', {class: 'payment_modal_input'}).append($('<div/>', {html: field['value']})))
        );
        return;
    } else if (field['view'] === 'js') {
        link_to_button.append($(field['value']));
        return;
    } else if (field['view'] === 'select') {
        input_field = $("<select id=\"" + field['name'] + "\" name=\"" + field['name'] + "\" />");
        for (var val in field['value']) {
            $("<option />", {value: val, text: field['value'][val]}).appendTo(input_field);
        }
    } else {
        if (field['type']) {
            input_field.prop({'type': field['type']});
        }

        if (field['value']) {
            input_field.prop({'value': field['value']});
        }

        if (field['class']) {
            input_field.prop({'class': field['class']});
        }

        if (field['name']) {
            input_field.prop({'name': field['name']});
        }

        if (field['placeholder']) {
            input_field.prop({'placeholder': field['placeholder']});
        }
    }

    link_to_button.before(
        $('<div/>', {class: 'payment_modal_row'})
            .append($('<div/>', {
                class: 'payment_modal_name name_' + field['name'],
                text: field['html_name']
            }), $('<div/>', {class: 'payment_modal_input'}).append(input_field, error_block))
    );

    if (field['view'] === 'select') {
        input_field.select2().on("select2:open", function (e) {
            $('.select2-results__options').addClass('scrollbar-inner').scrollbar();
        });
    }
}

function closeForm() {
    if (in_process) {
        return;
    }

    discardSocket();

    $('.wrap_section .payment_item').removeClass('active');
    $('.fon_modal').removeClass('active');
    payment_form_container.html('');
    paymentMethodsWrap.removeClass('payment-methods__wrap--hidden');

    payment_form.removeClass('active');
    payment_form.attr({'style': ''});
    files = null;

    if (payment_form.hasClass('full')) {
        payment_form.removeClass('full');
        removeFullIframe();
        payment_form_container.removeClass('scrollbar-inner');
        payment_form_container.scrollbar('destroy');
    }

    payment_form.css('height', 'auto');

    scrollHelper.current_height = null;
    resize();
}


function delZapros(id) {
    var confirm_delete = function () {

        if (in_process) {
            return;
        }

        var param = 'operation=delZapros' + '&id=' + id,
            url = '/' + window.location.pathname
                .split('/')
                .filter(function (item) {
                    if (item !== '') {
                        return item;
                    }
                })
                .join('/') + '/delete/';

        $.ajax({
            url: url,
            type: 'POST',
            data: param,
            beforeSend: function () {
                in_process = true;
            },
            success: function (data) {
                alerts(data['title'], data['message'], 1);
                reloadRequestList();
            },
            complete: function () {
                in_process = false;
            }
        });
    };

    alerts('', dictionary.get('delete_order'), 3, confirm_delete);
}

function getLink(elm, id, agent) {
    var url = '/' + window.location.pathname
            .split('/')
            .filter(function (item) {
                if (item !== '') {
                    return item;
                }
            })
            .join('/') + '/link/' + agent + '/',
        param = 'id=' + id;

    if (typeof arguments[3] !== 'undefined' && arguments[3] !== '') {
        param = 'sub_system=' + arguments[3] + '&' + param;
    }

    $(elm).after(dictionary.get('waiting') + ' ...');
    $(elm).remove();
    $.ajax({
        url: url,
        type: 'POST',
        data: param,
        dataType: 'json',
        success: function (data) {
            if (data['html']) {
                $('body').append(data['html']);
                $('#withdrawal_redirect_form').submit();
            } else if (data['success']) {
                //$(currentLink).attr({'href' :link.link});
                //redirect_parent_window(link.link);
                window.parent.location.href = data['message'];
            } else {
                alerts(data['title'], data['message'], 0);
                reloadRequestList();
            }
        }
    });
}

function reloadRequestList() {
    var url = '/' + window.location.pathname
        .split('/')
        .filter(function (item) {
            if (item !== '') {
                return item;
            }
        })
        .join('/') + '/reloadlist/';

    if (ajax['reloadRequestList'] !== undefined) {
        ajax['reloadRequestList'].abort();
    }

    ajax['reloadRequestList'] = $.ajax({
        url: url,
        type: 'POST',
        success: function (res) {
            var $tableCon = $('.requests_output_block');
            $tableCon.hide().find('.requests_output_row').remove();
            $tableCon.append($(res).find('.requests_output_block').html()).show();

            /*if (update_status !== null) {
                update_status.update(true);
            }*/
        }
    });
}

function getInfoFoWithdraw(id) {

    var url = '/' + window.location.pathname
        .split('/')
        .filter(function (item) {
            if (item !== '') {
                return item;
            }
        })
        .join('/') + '/infofowithdraw/';

    $.ajax({
        url: url,
        type: 'POST',
        data: 'id=' + id,
        success: function (res) {
            $('#info' + id).html(res.info);
        }
    });
}

function openLinkInFrame(url, height) {
    height = height || null;

    if (isInFrame()) {
        var frame = parent.document.getElementById('payments_frame');

        frame.src = url;

        if (height) {
            frame.height = height;
        }
    } else {
        window.location.href = url;
    }
}

function refreshKeybords() {
    var inputElems = [
        document.getElementsByTagName('input'),
        document.getElementsByTagName('textarea')
    ];
    for (var x = 0, elem; elem = inputElems[x++];) {
        for (var y = 0, ex; ex = elem[y++];) {
            if (ex.nodeName === "TEXTAREA" || ex.type === "text" || ex.type === "password") {
                if (ex.className.indexOf("keyboardInput") > -1) {
                    VKI_attach(ex);
                }
            }
        }
    }
}

window.onload = function () {
    resize();
};

function loadScript(url, callback) {
    var loadedScripts = document.getElementsByTagName('script'),
        script,
        i;
    for (i = 0; i < loadedScripts.length; i++) {

        if (loadedScripts[i].src.indexOf(url) !== -1) {
            callback();
            return;
        }
    }
    script = document.createElement('script');
    script.type = "text/javascript";
    if (script.readyState) {  // IE
        script.onreadystatechange = function () {
            if (script.readyState === 'loaded' || script.readyState === 'complete') {
                script.onreadystatechange = null;
                callback();
            }
        };
    } else {  // Others
        script.onload = function () {
            callback();
        };
    }

    script.src = url;
    document.getElementsByTagName('head')[0].appendChild(script);
}

function addFullIframe() {

    if (typeof isMobile === 'undefined' || isMobile !== 1) {
        return;
    }

    parent.document.getElementById('payments_frame').style.position = 'fixed';
    parent.document.getElementById('payments_frame').style.top = 0;
    parent.document.getElementById('payments_frame').style.zIndex = 100;

    scrollHelper.force_current_height = parent.window.innerHeight;
    document.getElementsByClassName('payment_modal')[0].style.height = scrollHelper.current_height + 'px';
}

function removeFullIframe() {

    if (typeof isMobile === 'undefined' || isMobile !== 1) {
        return;
    }

    parent.document.getElementById('payments_frame').style.position = 'static';
    parent.document.getElementById('payments_frame').style.top = 'auto';
    parent.document.getElementById('payments_frame').style.zIndex = 'auto';

    scrollHelper.force_current_height = null;
}


///**** обработка добавления файла ****////

var Files = {

    link_class: 'default',
    wrap_filename: 'default',
    wrap_inputfield: 'default',
    input_name: 'default',
    file_name_field: 'file-name-field',
    max_count_files: 3,
    count_files: 0,
    counter: 0,
    init: function (link_class, wrap_filename, wrap_inputfield, input_name, max_count) {
        var $this = this;

        this.count_files = 0;
        this.counter = 0;
        this.max_count_files = max_count || 3;
        this.link_class = link_class;
        this.wrap_filename = wrap_filename;
        this.wrap_inputfield = wrap_inputfield;
        this.input_name = input_name;

        $('.' + link_class).on('click', function (e) {
            e.preventDefault();

            $this.loadFile();
        });

        $('.' + wrap_inputfield).on('change', 'input[type=file]', function () {
            $this.attachFile(this);
        });

        $('.' + wrap_filename).on('click', '.delete-file', function () {
            $this.deleteFile(this);
        });

        return this;
    },
    loadFile: function () {
        if (this.count_files < this.max_count_files) {
            $('.' + this.wrap_inputfield).append($('<input/>', {
                'type': 'file',
                'id': 'file_' + this.counter,
                'name': this.input_name + '[doc_' + this.counter + ']',
                'data-name': this.counter
            }).click());
        }
    },
    attachFile: function (file) {
        var path = $(file).val(),
            current_file = $(file).attr('data-name'),
            match = false;

        this.clearError();

        var filename = path.replace(/C\:\\fakepath\\/gi, '');
        $('.name-file').each(function (inx, elm) {
            if ($(elm).text() === filename) {
                match = true;
            }
        });

        if (match) {
            this.deleteInputField('file_' + current_file);
            this.showError('File ' + filename + ' exists');
            return;
        }

        $('.' + this.wrap_filename).append($('<p/>', {
            'class': this.file_name_field,
            'data-id': 'file_' + current_file,
            'name': this.input_name + '[doc_' + current_file + ']'
        }).append(
            $('<span/>', {
                'class': 'delete-file',
                'text': 'x'
            }),
            ' ',
            $('<span/>', {
                'text': filename,
                'class': 'name-file'
            })
        ));

        this.count_files++;
        this.counter++;

        if (this.count_files === this.max_count_files) {
            $('.' + this.link_class).hide();
        }
    },
    deleteFile: function (file) {
        var wrap_link = $(file).closest('.' + this.file_name_field),
            id_input_file = wrap_link.attr('data-id');

        wrap_link.remove();

        this.deleteInputField(id_input_file);

        if (this.count_files < this.max_count_files) {
            $('.' + this.link_class).show();
        }
    },
    deleteInputField: function (id) {
        $('#' + id).remove();
        this.count_files--;
        this.counter--;
    },
    showError: function (message) {
        $('#payment_error_' + this.input_name).text(message);
    },
    clearError: function () {
        $('#payment_error_' + this.input_name).text('');
    }
};

function changeCurrencies(way) {
    var i,
        out_payways,
        selected_out_payway,
        in_payways,
        selected_in_payway,
        out_currencies,
        selected_out_currency,
        in_currencies,
        selected_in_currency,
        selected_index,
        out_json_payways,
        in_json_payways,
        currencies_list,
        exchange_way,
        select_currencies;

    out_payways = document.getElementById("out_payways");
    selected_index = out_payways.options.selectedIndex;
    selected_out_payway = out_payways.options[selected_index].value;

    in_payways = document.getElementById("in_payways");
    selected_index = in_payways.options.selectedIndex;
    selected_in_payway = in_payways.options[selected_index].value;

    out_currencies = document.getElementById("out_currencies");
    in_currencies = document.getElementById("in_currencies");

    out_json_payways = JSON.parse(atob(document.getElementById("out_payways_json").value));
    in_json_payways = JSON.parse(atob(document.getElementById("in_payways_json").value));

    currencies_list = ('out' === way) ? out_json_payways[selected_out_payway]['currencies'] : in_json_payways[selected_in_payway]['currencies'];

    var str = '', selected = ' selected';
    for (i = 0; i < currencies_list.length; i++) {
        str += '<option value="' + currencies_list[i].currency + '" data-agent' + selected + '>' + currencies_list[i].currency + '</option>';
        if (selected) selected = '';
    }

    select_currencies = ('out' === way) ? out_currencies : in_currencies;
    select_currencies.innerHTML = str;

    out_currencies = document.getElementById("out_currencies");
    selected_index = out_currencies.options.selectedIndex;
    selected_out_currency = out_currencies.options[selected_index].value;

    in_currencies = document.getElementById("in_currencies");
    selected_index = in_currencies.options.selectedIndex;
    selected_in_currency = in_currencies.options[selected_index].value;

    var min_amount = 0;
    for (i = 0; i < out_json_payways[selected_out_payway]['currencies'].length; i++) {
        if (out_json_payways[selected_out_payway]['currencies'][i]['currency'] === selected_out_currency) {
            min_amount = parseFloat(out_json_payways[selected_out_payway]['currencies'][i]['min']);
            break;
        }
    }

    exchange_way = JSON.parse(atob(document.getElementById("exchanges_json").value))[selected_out_currency][selected_in_currency];

    if (typeof exchange_way === 'undefined' && selected_out_currency !== selected_in_currency) {
        alert('Обмен ' + selected_out_currency + ' на ' + selected_in_currency + ' недоступен');
        return false;
    }

    if (selected_out_currency === selected_in_currency) {
        document.getElementById('amount').value = min_amount;
        document.getElementById('min_amount').textContent = String(min_amount);
        document.getElementById('default_out_currency').textContent = String(selected_out_currency.toUpperCase());
    } else {
        if (typeof exchange_way['tech_min'] !== 'undefined') {
            if (parseFloat(exchange_way['tech_min']) > min_amount) {
                min_amount = parseFloat(exchange_way['tech_min']);
            }
        }
        document.getElementById('amount').value = min_amount;
        document.getElementById('min_amount').textContent = String(min_amount);
        document.getElementById('default_out_currency').textContent = String(selected_out_currency);
    }

    var payer = document.getElementById(way + '_payer');
    var contact = document.getElementById(way + '_contact');
    var selected_payway = ('out' === way) ? selected_out_payway : selected_in_payway;
    payer.parentNode.parentNode.style.display = "flex";

    switch (selected_payway) {
        case 'visamc':
            try {
                contact.parentNode.parentNode.style.display = "none";
            } catch (e) {
            }
            payer.setAttribute('placeholder', '5213****1675');
            payer.parentNode.parentNode.getElementsByClassName('payment_modal_name name_' + way + '_payer')[0].textContent = 'Номер карты';
            break;
        case 'qiwi':
            try {
                contact.parentNode.parentNode.style.display = "flex";
            } catch (e) {
            }
            payer.setAttribute('placeholder', '7XXXXXXXXXX');
            payer.parentNode.parentNode.getElementsByClassName('payment_modal_name name_' + way + '_payer')[0].textContent = 'Номер телефона';
            break;
        case 'webmoney':
            try {
                contact.parentNode.parentNode.style.display = "none";
            } catch (e) {
            }
            payer.setAttribute('placeholder', 'Z***********');
            payer.parentNode.parentNode.getElementsByClassName('payment_modal_name name_' + way + '_payer')[0].textContent = 'Номер кошелька';
            break;
        default:
            try {
                contact.parentNode.parentNode.style.display = "none";
            } catch (e) {
            }
            if ('out' === way) {
                payer.parentNode.parentNode.style.display = "none";
            } else {
                payer.setAttribute('placeholder', '***********');
                payer.parentNode.parentNode.getElementsByClassName('payment_modal_name name_' + way + '_payer')[0].textContent = 'Адрес';
            }
    }
}

function saveBonus() {
    alerts(dictionary.get('message'), dictionary.get('save_bonus'), 0);
}

function cancelBonus() {
    var settings = {
        buttons: {
            ok: dictionary.get('yes'),
            cancel: dictionary.get('no')
        },
        functions: {
            ok: 'closeBonus()',
            cancel: 'saveBonus()'
        }
    };
    alerts(dictionary.get('confirm_action'), dictionary.get('cancel_bonus'), 6, settings);
}

function closeBonus() {

    var url = '/' + window.location.pathname
        .split('/')
        .filter(function (item) {
            if (item !== '') {
                return item;
            }
        })
        .join('/') + '/cancelbonus/';

    $.ajax({
        url: url,
        type: 'POST',
        success: function (data) {
            alerts('', data['message']);
        }
    });
}

function customAction(paysystem, sub_system, request) {
    var url = '/' + window.location.pathname
        .split('/')
        .filter(function (item) {
            if (item !== '') {
                return item;
            }
        })
        .join('/') + '/custom/' + paysystem + '/' + sub_system + '/' + request;

    $.ajax({
        url: url,
        type: 'POST',
        success: function (data) {
            alerts('', data['message']);
        }
    });
}

function openHintImage() {
    var dropdown = $('.js-payment-modal-dropdown');

    if (dropdown.length) {
        dropdown.addClass('payment-modal-name--is-active');

        setTimeout(function () {
            $(document).one('click', function () {
                $('.js-payment-modal-dropdown').removeClass('payment-modal-name--is-active');
            });
        });
    }
}

function checkRequestStatus(id, period, paysystem, sub_system) {
    var url = window.location.origin + '/paysystems/deposit/checkrequest/' + paysystem + '/' + sub_system + '/';
    $.ajax({
        url: url,
        type: 'POST',
        data: {
            id: id,
        },
        success: function (data) {
             switch (data['code']) {
                 case 11:
                     setTimeout(function () {
                         if (!$('#payment_modal_container').html()) {
                             return;
                         }
                         checkRequestStatus(id, period, paysystem, sub_system);
                     }, period * 1000);
                     break;
                 case 10:
                     alerts(dictionary.get('error'), dictionary.get('unknown_error'));
                     return;
                 default:
                     var event = new Event('request_queue_done');
                     event.data = data;
                     document.dispatchEvent(event);
                     break;
             }
        }
    });
}

function closeSocket() {

    if (
        typeof otpSocket !== 'undefined'
        && otpSocket.readyState === otpSocket.OPEN
    ) {
        otpCloseOperation();
    }
}

function discardSocket() {

    if (
        typeof otpSocket !== 'undefined'
        && otpSocket.readyState === otpSocket.OPEN
    ) {
        otpDiscardOperation();
    }
}

function cacheReload() {
    window.onpageshow = function (evt) {
        if (evt.persisted) {
            document.body.style.display = 'none';
            location.reload();
        }
    };
}
