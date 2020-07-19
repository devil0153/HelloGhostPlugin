/*!
 * https://www.ghostplugin.com/
 * ghost.js v0.2.4
 * Copyright 2020 Demonicsoft Inc.
 * Released under the MIT License.
 */
(function (global, factory) {

    'use strict';

    if (typeof module === 'object' && typeof module.exports === 'object') {

        module.exports = global.document ?
            factory(global, true) :
            function (w) {
                if (!w.document) {
                    throw new Error('GhostPlugin requires a window with a document');
                }
                return factory(w);
            };
    } else {
        factory(global);
    }

})(typeof window !== 'undefined' ? window : this, function (window, noGlobal) {

    'use strict';

    //.browser
    var Browser = (function (window) {
        function normalizeVersion(version) {
            var start, end;
            start = version.indexOf('.');
            if (start > 0) {
                end = version.indexOf('.', start + 1);
                if (end !== -1) {
                    return version.substr(0, end);
                }
            }
            return version;
        }

        var type = 'unknown',
            version = '-1',
            agent = window.navigator.userAgent;
        try {
            if (agent.indexOf('GhostEmulator') > -1) {
                type = 'Emulator';
                version = agent.match(/GhostEmulator\/([\d.]+)/)[1];
            } else if (agent.indexOf('MetaSr') > -1) {
                type = 'MetaSr';
                version = (agent.indexOf('Chrome') > -1 ? 'Chrome:' : 'IE:') + agent.match(/MetaSr\ ([\d.]+)/)[1];
            } else if (agent.indexOf('QQBrowser') > -1) {
                type = 'QQ';
                version = (agent.indexOf('Chrome') > -1 ? 'Chrome:' : 'IE:') + agent.match(/QQBrowser\/([\d.]+)/)[1];
            } else if (/MSIE 10.0/.test(agent)) {
                type = 'IE';
                version = '10';
            } else if (/rv:([\d.]+)\) like gecko/.test(agent.toLowerCase())) {
                type = 'IE';
                version = '11';
            } else if (agent.indexOf('Edg') > -1) {
                type = 'Edg';
                version = agent.match(/Edg\/([\d.]+)/)[1];
            } else if (agent.indexOf('Opera') > -1 || agent.indexOf('OPR') > -1) {
                type = 'Opera';
                version = agent.indexOf('Opera') > -1 ? agent.match(/Opera.([\d.]+)/)[1] : agent.match(/OPR\/([\d.]+)/)[1];
            } else if (agent.indexOf('Chrome') > -1 && agent.indexOf('Safari') > -1) {
                type = 'Chrome';
                version = agent.match(/Chrome\/([\d.]+)/)[1];
            } else if (agent.indexOf('Firefox') > -1) {
                type = 'Firefox';
                version = agent.match(/Firefox\/([\d.]+)/)[1];
            }
            if (version)
                version = normalizeVersion(version);
        } catch (e) {
            type = 'unknown';
            version = '-1';
        }
        return {
            type: type,
            version: version
        };
    })(window);

    if (Browser.type === 'unknown') {
        throw new Error('GhostPlugin do not Support current browser.');
    }


    //.uuid
    var hexDigits = '0123456789abcdef';
    function uuid() {
        var buffer = [];
        for (var i = 0; i < 36; i++) {
            buffer[i] = i === 8 || i === 13 || i === 18 || i === 23 ? '-' : hexDigits[Math.floor(Math.random() * 16)];
        }
        return buffer.join('');
    }

    //.private
    var version = '0.2.4',
        localDomain = '4u.ghostplugin.com',
        gps = [],
        isPageActive = true,
        senderId = uuid(),
        emptyFn = function () { };

    function hostProxy(gp, name) {
        return function () {
            var callback = null, args = Array.prototype.slice.call(arguments);
            if (arguments.length > 0) {
                var lastArg = args[args.length - 1];
                if (typeof lastArg === 'function') {
                    callback = lastArg;
                    args.length -= 1;
                }
            }
            gp.invoke(name, args, callback);
        };
    }

    function sendRegister(ws, extension, extensionConfig, gp) {
        var registerEntity = {
            command: 'register',
            id: uuid(),
            senderId: senderId,
            content: {
                extensionKey: extension.extensionKey,
                extensionVersion: extension.extensionVersion,
                extensionToken: extension.extensionToken,
                browserTitle: document.title,
                browserType: Browser.type,
                browserVersion: Browser.version,
                viewEntity: gp.viewEntity,
                extensionConfig: extensionConfig,
                host: window.location.origin
            }
        };
        var ps = ws.send(JSON.stringify(registerEntity));
        if (GhostPlugin.isEmulated) {
            ps.then(function (result) {
                var acceptEntity = JSON.parse(result);
                gp.token = acceptEntity.token;
                gp.wws = connectToGhost(acceptEntity.port, acceptEntity.token, gp);
            });
        }
    }

    function connectToGhost(port, token, gp) {
        var wws = new WebSocket('wss://' + localDomain + ':' + port + '/angel?token=' + token);
        wws.onopen = function () {
            window.setTimeout(function () {
                gp.isReady = true;
                if (gp._ready)
                    gp._ready(gp);
            }, 100);
        };

        wws.onmessage = function (e) {
            var json = e.data;
            var msg = JSON.parse(json);
            switch (msg.command) {
                case 'invoke_rsp':
                    if (gp.invokeList && gp.invokeList[msg.id]) {
                        gp.invokeList[msg.id](msg.content);
                        delete gp.invokeList[msg.id];
                    }
                    break;
                case 'invoke':
                    {
                        var result = null, isSuccess = false;
                        if (gp.client[msg.content.command]) {
                            try {
                                result = gp.client[msg.content.command].apply(gp, msg.content.args);
                                isSuccess = true;
                            } catch (error) {
                                result = error.message;
                            }
                        } else {
                            result = 'can\'t find method "' + msg.content.command + '", pay attention to case sensitivity';
                        }
                        gp.wws.send(JSON.stringify({
                            command: 'invoke_rsp',
                            id: msg.id,
                            senderId: senderId,
                            content: {
                                isSuccess: isSuccess,
                                result: result
                            }
                        }));
                    }
                    break;
                case 'info':
                    info(gp, msg.content.code, msg.content.info);
                    break;
                case 'error':
                    error(gp, msg.content.code, msg.content.info);
                    break;
                case 'warn':
                    warn(gp, msg.content.code, msg.content.info);
                    break;
            }
        };

        wws.onclose = function () {
            gp.isReady = false;
            if (gp._close)
                gp._close(gp);
        };
        return wws;
    }

    function apply(src, tar) {
        if (tar) {
            for (var key in tar || {}) {
                src[key] = tar[key];
            }
        }
    }

    var moreInfo = ' for more information please visit https://www.ghostplugin.com/docs/latest/get-started/msgcode#';

    function error(gp, code, info) {
        if (gp._error !== emptyFn)
            gp._error(code, info);
        else
            console.error('[GP][' + code + '] ' + info + moreInfo + code);
    }

    function info(gp, code, info) {
        if (gp._info !== emptyFn)
            gp._info(code, info);
        else
            console.info('[GP][' + code + '] ' + info + moreInfo + code);
    }

    function warn(gp, code, info) {
        if (gp._warn !== emptyFn)
            gp._warn(code, info);
        else
            console.warn('[GP][' + code + '] ' + info + moreInfo + code);
    }

    var GhostPlugin = function () {
        this.host = {};
        this.client = {};
        this._ready = this._close = this._info = this._warn = this._error = emptyFn;
        gps.push(this);
    };
    
    GhostPlugin.isEmulated = Browser.type === 'Emulator';
    GhostPlugin.prototype = {
        load: function (extension, extensionConfig, viewConfig) {
            var gp = this;
            gp.isReady = null;
            if (viewConfig) {
                gp.viewConfig = viewConfig;
                gp.viewEntity = {
                    isActive: true,
                    isVisible: true
                };
                apply(gp.viewEntity, getViewConfig(viewConfig));
            }

            if (GhostPlugin.isEmulated) {
                CefSharp.BindObjectAsync('emulator').then(function () {
                    sendRegister(emulator, extension, extensionConfig, gp);
                });
            } else {
                var ws = new WebSocket('wss://' + localDomain + ':34543/angel?v=' + version);
                ws.onopen = function () {
                    sendRegister(ws, extension, extensionConfig, gp);
                };

                ws.onmessage = function (e) {
                    var msg = JSON.parse(e.data);
                    var content = msg.content;
                    switch (msg.command) {
                        case 'register_rsp':
                            var port = content.port;
                            var token = content.token;
                            gp.token = token;
                            gp.wws = connectToGhost(port, token, gp);
                            ws.close();
                            break;
                        case 'info':
                            info(gp, content.code, content.info);
                            break;
                        case 'warn':
                            warn(gp, content.code, content.info);
                            break;
                        case 'error':
                            error(gp, content.code, content.info);
                            break;
                    }
                };

                ws.onclose = function (e) {
                    GhostPlugin.isAvailable = e.code === 1005;
                    if (!GhostPlugin.isAvailable)
                        error(gp, 20001, 'host unavailable');
                };
            }
            return this;
        },
        onConnected: function (func) {
            this._ready = func;
            return this;
        },
        onInfo: function (func) {
            this._info = func;
            return this;
        },
        onError: function (func) {
            this._error = func;
            return this;
        },
        onWarn: function (func) {
            this._warn = func;
            return this;
        },
        onDisconnect: function (func) {
            this._close = func;
            return this;
        },
        invoke: function (cmd, args, callback) {
            if (!this.invokeList)
                this.invokeList = {};
            var invokeEntity = {
                command: 'invoke',
                id: uuid(),
                senderId: senderId,
                content: {
                    command: cmd,
                    args: args
                }
            };
            this.invokeList[invokeEntity.id] = callback;
            this.wws.send(JSON.stringify(invokeEntity));
        },
        updateView: function (viewConfig) {
            if (this.viewEntity) {
                apply(this.viewConfig, viewConfig);
                apply(this.viewEntity, getViewConfig(this.viewConfig));
                this.wws.send(JSON.stringify({
                    command: 'updateView',
                    id: uuid(),
                    senderId: senderId,
                    content: this.viewEntity
                }));
            }
            return this;
        },
        show: function () {
            this.updateView({ isVisible: true });
            return this;
        },
        hide: function () {
            this.updateView({ isVisible: false });
            return this;
        },
        unload: function () {
            if (this.wss)
                this.wss.close();
        },
        getState: function () {
            if (this.isReady === undefined) {
                return 'created';
            } else if (this.isReady === null) {
                return 'connecting';
            } else if (this.isReady === true) {
                return 'connected';
            } else if (this.isReady === false) {
                return 'disconnect';
            }
            return 'unknown';
        },
        makeHostProxy: function () {
            this.host = {};
            for (var i = 0; i < arguments.length; i++) {
                this.host[arguments[i]] = hostProxy(this, arguments[i]);
            }
        }
    };

    function updateAllView(viewConfig) {
        for (var i = 0; i < gps.length; i++) {
            var gp = gps[i];
            if (gp.isReady)
                gp.updateView(viewConfig);
        }
    }

    var scrollbarWidth = 0;
    var docEle = document.documentElement;
    function getViewConfig(viewConfig) {
        if (Browser.type === 'Firefox')
            return getViewConfigFirefox(viewConfig);
        else
            return getViewConfigChrome(viewConfig);
    }

    function getViewConfigChrome(viewConfig) {
        var width = viewConfig.width, height = viewConfig.height, marginLeft = viewConfig.marginLeft, marginTop = viewConfig.marginTop, isVisible = viewConfig.isVisible;
        var offsetLeft = marginLeft - docEle.scrollLeft;
        var offsetTop = marginTop - docEle.scrollTop;
        var contentLeft = Math.min(offsetLeft - (viewConfig.offsetLeft || 0), 0);
        var contentTop = Math.min(offsetTop - (viewConfig.offsetTop || 0), 0);
        var viewportLeft = Math.max(offsetLeft, viewConfig.offsetLeft || 0);
        var viewportTop = Math.max(offsetTop, viewConfig.offsetTop || 0);
        return {
            viewportWidth: Math.min(width + contentLeft, window.innerWidth - (viewConfig.offsetRight || 0) - (hasVScrollbar() ? scrollbarWidth : 0) - viewportLeft),
            viewportHeight: Math.min(height + contentTop, window.innerHeight - (viewConfig.offsetBottom || 0) - (hasHScrollbar() ? scrollbarWidth : 0) - viewportTop),
            viewportLeft: viewportLeft,
            viewportTop: viewportTop,
            contentWidth: width,
            contentHeight: height,
            contentLeft: contentLeft,
            contentTop: contentTop,
            isActive: !!isPageActive,
            isVisible: isVisible
        };
    }

    function getViewConfigFirefox(viewConfig) {
        var width = viewConfig.width, height = viewConfig.height, marginLeft = viewConfig.marginLeft, marginTop = viewConfig.marginTop, isVisible = viewConfig.isVisible;
        var offsetLeft = marginLeft - docEle.scrollLeft;
        var offsetTop = marginTop - docEle.scrollTop;
        var contentLeft = Math.min(offsetLeft - (viewConfig.offsetLeft || 0), 0);
        var contentTop = Math.min(offsetTop - (viewConfig.offsetTop || 0), 0);
        var viewportLeft = Math.max(offsetLeft, viewConfig.offsetLeft || 0);
        var viewportTop = Math.max(offsetTop, viewConfig.offsetTop || 0);

        var fixedLeft = getFirefoxViewportLeft();
        var fixedTop = getFirefoxViewportTop();

        return {
            viewportWidth: Math.min(width + contentLeft, window.innerWidth - (viewConfig.offsetRight || 0) - (hasVScrollbar() ? scrollbarWidth : 0) - viewportLeft),
            viewportHeight: Math.min(height + contentTop, window.innerHeight - (viewConfig.offsetBottom || 0) - (hasHScrollbar() ? scrollbarWidth : 0) - viewportTop),
            viewportLeft: viewportLeft + fixedLeft,
            viewportTop: viewportTop + fixedTop,
            contentWidth: width,
            contentHeight: height,
            contentLeft: contentLeft,
            contentTop: contentTop,
            isActive: !!isPageActive,
            isVisible: isVisible
        };
    }

    window.addEventListener('focus', function () { isPageActive = true; updateAllView({ isActive: true }); });
    window.addEventListener('blur', function () { isPageActive = false; updateAllView({ isActive: false }); });
    window.addEventListener('resize', function () { updateAllView(); });
    window.addEventListener('scroll', function () { updateAllView(); });

    document.addEventListener('DOMContentLoaded', function () {
        scrollbarWidth = getScrollbarWidth();
    });

    function getScrollbarWidth() {

        // Creating invisible container
        var outer = document.createElement('div');
        outer.style.visibility = 'hidden';
        outer.style.overflow = 'scroll'; // forcing scrollbar to appear
        outer.style.msOverflowStyle = 'scrollbar'; // needed for WinJS apps
        document.body.appendChild(outer);

        // Creating inner element and placing it in the container
        var inner = document.createElement('div');
        outer.appendChild(inner);

        // Calculating difference between container's full width and the child width
        var scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

        // Removing temporary elements from the DOM
        outer.parentNode.removeChild(outer);

        return scrollbarWidth;

    }

    function hasHScrollbar() {
        if (document.body)
            return document.body.scrollWidth > document.body.clientWidth;
        return 0;
    }
    function hasVScrollbar() {
        if (document.body)
            return document.body.scrollHeight > window.innerHeight - (hasHScrollbar() ? scrollbarWidth : 0);
        return 0;
    }

    //browser util

    function getFirefoxViewportLeft() {
        var left = window.outerWidth - window.innerWidth;
        if (isFirefoxFullScreen())
            return left;
        else if (isFirefoxMaximize())
            return left - 16;
        else
            return left - 11;
    }

    function getFirefoxViewportTop() {
        var top = window.outerHeight - window.innerHeight;
        if (isFirefoxFullScreen())
            return top;
        else if (isFirefoxMaximize())
            return top - 15;
        else
            return top - 7;
    }

    function isFirefoxMaximize() {
        if ((window.screen.availLeft - window.screenX) * 2 === window.outerWidth - window.screen.availWidth &&
            (window.screen.availTop - window.screenY) * 2 === window.outerHeight - window.screen.availHeight)
            return true;
        return false;
    }

    function isFirefoxFullScreen() {
        if (window.screenX === window.screen.availLeft &&
            window.screenY === window.screen.availTop &&
            window.outerHeight === window.screen.height &&
            window.outerWidth === window.screen.width) {
            return true;
        }
        return false;
    }

    GhostPlugin.check = function (callback) {
        if (GhostPlugin.isEmulated) {
            if (callback) callback(true);
        } else {
            var ws = new WebSocket('wss://' + localDomain + ':34543/angel?c=' + version);
            ws.onopen = function () { ws.close(); };
            ws.onclose = function (e) {
                if (callback) callback(e.code === 1005);
            };
        }
    };
    GhostPlugin.check(function (isAvailable) { GhostPlugin.isAvailable = isAvailable; });
    GhostPlugin.version = version;

    if (typeof noGlobal === 'undefined') {
        window.GhostPlugin = GhostPlugin;
    }

    return GhostPlugin;
});
