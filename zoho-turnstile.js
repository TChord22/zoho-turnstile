/**
 * zoho-turnstile.js
 * =================
 * Drop-in Cloudflare Turnstile protection for Zoho Form HTML exports.
 *
 * Usage:
 *   <script src="zoho-turnstile.js"></script>
 *   <script>
 *     ZohoTurnstile.init({
 *       siteKey:   'YOUR_CLOUDFLARE_SITE_KEY',
 *       verifyUrl: 'https://your-worker.workers.dev', // optional but recommended
 *       theme:     'light',                           // 'light' | 'dark' | 'auto'
 *       size:      'normal',                          // 'normal' | 'compact'
 *     });
 *   </script>
 *
 * @version 1.0.0
 * @license MIT
 */

(function (global) {
    'use strict';

    // ── Constants ──────────────────────────────────────────────────────────────
    var TURNSTILE_CDN = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    var WIDGET_CLASS = 'zt-widget-wrap';
    var ERROR_ID = 'zt-error';
    var FIELD_NAME = 'cf-turnstile-response';

    // ── Default config ─────────────────────────────────────────────────────────
    var defaults = {
        siteKey: '',
        verifyUrl: null,
        theme: 'light',
        size: 'normal',
        errorMessage: 'Please complete the security check before submitting.',
        containerId: null,   // optional — override where widget is injected
        onSuccess: null,   // callback(token) when Turnstile issues a token
        onError: null,   // callback() on Turnstile error
        onExpire: null,   // callback() when token expires
    };

    // ── Internal state ─────────────────────────────────────────────────────────
    var cfg = {};
    var form = null;
    var _ready = false;

    // ── Public API ─────────────────────────────────────────────────────────────
    var ZohoTurnstile = {

        /**
         * Initialise the library. Call once after the DOM is ready.
         * @param {Object} options — see defaults above
         */
        init: function (options) {
            cfg = _merge(defaults, options);

            if (!cfg.siteKey) {
                _warn('siteKey is required. Turnstile will not be loaded.');
                return;
            }

            _domReady(function () {
                form = _findForm();
                if (!form) {
                    _warn('No Zoho form found on the page (looked for <form name="form" id="form">).');
                    return;
                }

                _injectStyles();
                _injectWidget();
                _patchSubmit();
                _loadTurnstileScript();
            });
        },

        /**
         * Manually reset the Turnstile widget (e.g. after a failed server response).
         */
        reset: function () {
            if (global.turnstile && _widgetId !== undefined) {
                global.turnstile.reset(_widgetId);
            }
        },

        /**
         * Returns the current token value, or empty string if not yet issued.
         */
        getToken: function () {
            var input = form && form.querySelector('input[name="' + FIELD_NAME + '"]');
            return input ? input.value.trim() : '';
        },
    };

    // ── Private ────────────────────────────────────────────────────────────────

    var _widgetId;

    function _loadTurnstileScript() {
        if (global.turnstile) {
            _renderWidget();
            return;
        }
        var s = document.createElement('script');
        s.src = TURNSTILE_CDN + '?render=explicit';
        s.async = true;
        s.defer = true;
        s.onload = function () {
            _renderWidget();
        };
        document.head.appendChild(s);
    }

    function _renderWidget() {
        var container = document.getElementById(WIDGET_CLASS);
        if (!container) return;

        _widgetId = global.turnstile.render(container, {
            sitekey: cfg.siteKey,
            theme: cfg.theme,
            size: cfg.size,
            callback: function (token) {
                _hideError();
                _ready = true;
                if (typeof cfg.onSuccess === 'function') cfg.onSuccess(token);
            },
            'error-callback': function () {
                _ready = false;
                if (typeof cfg.onError === 'function') cfg.onError();
            },
            'expired-callback': function () {
                _ready = false;
                if (typeof cfg.onExpire === 'function') cfg.onExpire();
            },
        });
    }

    function _injectWidget() {
        // Find the submit button's parent <li> or footer
        var footer = form.querySelector('.zf-fmFooter') || form.querySelector('[class*="fmFooter"]');
        if (!footer) {
            _warn('Could not find .zf-fmFooter to inject widget. Use containerId option to specify a target.');
            return;
        }

        // Use custom container if provided
        if (cfg.containerId) {
            var custom = document.getElementById(cfg.containerId);
            if (custom) { custom.appendChild(_buildWidgetMarkup()); return; }
        }

        // Default: inject above the footer
        var wrap = _buildWidgetMarkup();
        footer.parentNode.insertBefore(wrap, footer);
    }

    function _buildWidgetMarkup() {
        var outer = document.createElement('div');
        outer.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:8px 0 0 0;';

        var container = document.createElement('div');
        container.id = WIDGET_CLASS;
        outer.appendChild(container);

        var err = document.createElement('p');
        err.id = ERROR_ID;
        err.textContent = cfg.errorMessage;
        outer.appendChild(err);

        return outer;
    }

    function _patchSubmit() {
        // Wrap the existing Zoho onsubmit handler
        var original = form.onsubmit;

        form.onsubmit = function (e) {
            // 1. Check Turnstile token is present
            if (!_checkToken()) {
                e && e.preventDefault();
                return false;
            }

            // 2. If verifyUrl provided, intercept and verify before allowing submit
            if (cfg.verifyUrl) {
                e && e.preventDefault();
                _serverVerify(function (ok) {
                    if (ok) {
                        // Re-run original Zoho validation then submit
                        if (typeof original === 'function' && !original.call(form)) return;
                        form.submit();
                    } else {
                        _showError('Security check failed. Please refresh and try again.');
                        ZohoTurnstile.reset();
                    }
                });
                return false;
            }

            // 3. No verifyUrl — run original Zoho validation as normal
            if (typeof original === 'function') {
                return original.call(form);
            }
            return true;
        };
    }

    function _checkToken() {
        var token = ZohoTurnstile.getToken();
        if (!token) {
            _showError();
            return false;
        }
        _hideError();
        return true;
    }

    function _serverVerify(callback) {
        var token = ZohoTurnstile.getToken();
        fetch(cfg.verifyUrl + '/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token }),
        })
            .then(function (res) { return res.json(); })
            .then(function (data) { callback(data.success === true); })
            .catch(function () { callback(false); });
    }

    function _showError(msg) {
        var el = document.getElementById(ERROR_ID);
        if (el) {
            el.textContent = msg || cfg.errorMessage;
            el.style.display = 'block';
        }
    }

    function _hideError() {
        var el = document.getElementById(ERROR_ID);
        if (el) el.style.display = 'none';
    }

    function _injectStyles() {
        if (document.getElementById('zt-styles')) return;
        var style = document.createElement('style');
        style.id = 'zt-styles';
        style.textContent = [
            '#' + ERROR_ID + '{',
            '  display:none;',
            '  text-align:center;',
            '  font:15px Arial,Helvetica,sans-serif;',
            '  color:#f41033;',
            '  margin:8px 0 0 0;',
            '  padding:0;',
            '}',
        ].join('\n');
        document.head.appendChild(style);
    }

    function _findForm() {
        // Zoho exports always use name="form" and id="form"
        return document.getElementById('form') ||
            document.querySelector('form[name="form"]') ||
            document.querySelector('form[action*="zohopublic.com"]');
    }

    function _merge(base, overrides) {
        var result = {};
        for (var k in base) result[k] = base[k];
        for (var k in overrides) result[k] = overrides[k];
        return result;
    }

    function _domReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    function _warn(msg) {
        if (global.console && global.console.warn) {
            global.console.warn('[ZohoTurnstile] ' + msg);
        }
    }

    // ── Export ─────────────────────────────────────────────────────────────────
    global.ZohoTurnstile = ZohoTurnstile;

}(typeof window !== 'undefined' ? window : this));