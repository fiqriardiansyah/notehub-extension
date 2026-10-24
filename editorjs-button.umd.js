(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["AnyButton"] = factory();
	else
		root["AnyButton"] = factory();
})(self, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/index.js":
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AnyButton)
/* harmony export */ });
/* harmony import */ var _index_scss__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./index.scss */ "./src/index.scss");
/* harmony import */ var _toolbox_icon_svg__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./toolbox-icon.svg */ "./src/toolbox-icon.svg");
/* harmony import */ var codex_notifier__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! codex-notifier */ "./node_modules/codex-notifier/dist/bundle.js");
/* harmony import */ var codex_notifier__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(codex_notifier__WEBPACK_IMPORTED_MODULE_2__);
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }



var AnyButton = /*#__PURE__*/function () {
  /**
   *
   * @param data
   * @param config
   * @param api
   * @param readOnly
   */
  function AnyButton(_ref) {
    var data = _ref.data,
      config = _ref.config,
      api = _ref.api,
      readOnly = _ref.readOnly;
    _classCallCheck(this, AnyButton);
    this.api = api;
    this.readOnly = readOnly;
    this.nodes = {
      wrapper: null,
      container: null,
      inputHolder: null,
      toggleHolder: null,
      anyButtonHolder: null,
      textInput: null,
      linkInput: null,
      registButton: null,
      anyButton: null
    };
    //css overwrite
    var _CSS = {
      baseClass: this.api.styles.block,
      hide: "hide",
      btn: "anyButton__btn",
      container: "anyButtonContainer",
      input: "anyButtonContainer__input",
      inputHolder: "anyButtonContainer__inputHolder",
      inputText: "anyButtonContainer__input--text",
      inputLink: "anyButtonContainer__input--link",
      registButton: "anyButtonContainer__registerButton",
      anyButtonHolder: "anyButtonContainer__anyButtonHolder",
      btnColor: "anyButton__btn--default"
    };
    this.CSS = Object.assign(_CSS, config.css);
    this.linkValidation = config.linkValidation || this.defaultLinkValidation.bind(this);
    this.textValidation = config.textValidation || this.defaultTextValidation.bind(this);
    this.data = {
      link: "",
      text: ""
    };
    this.data = data;
  }
  return _createClass(AnyButton, [{
    key: "renderSettings",
    value: function renderSettings() {
      var _this = this;
      var tunes = AnyButton.tunes;
      return tunes.map(function (tune) {
        return {
          icon: tune.icon,
          label: _this.api.i18n.t(tune.title),
          name: tune.name,
          onActivate: function onActivate() {
            _this.data = {
              "link": _this.nodes.linkInput.textContent,
              "text": _this.nodes.textInput.textContent
            };
            _this.show(Number(AnyButton.STATE.EDIT));
          }
        };
      });
    }

    /**
     * Returns true to notify the core that read-only mode is supported
     *
     * @return {boolean}
     */
  }, {
    key: "data",
    get:
    /**
     *
     * @returns {{text: string, link: string}}
     */
    function get() {
      return this._data;
    }

    /**
     * セーブ時のバリデーション
     * @param savedData
     * @returns {boolean}
     */,
    set:
    /**
     *
     * @param data
     */
    function set(data) {
      this._data = Object.assign({}, {
        link: this.api.sanitizer.clean(data.link || "", AnyButton.sanitize),
        text: this.api.sanitizer.clean(data.text || "", AnyButton.sanitize)
      });
    }
  }, {
    key: "validate",
    value: function validate(savedData) {
      if (this._data.link === "" || this._data.text === "") {
        return false;
      }
      return true;
    }
    /**
     *
     * @param block
     * @returns {{caption: string, text: string, alignment: string}}
     */
  }, {
    key: "save",
    value: function save(block) {
      return this._data;
    }

    /**
     * タグを全部削除する
     * @returns {{link: boolean, text: boolean}}
     */
  }, {
    key: "defaultLinkValidation",
    value: function defaultLinkValidation(text) {
      //全ての文字列が渡されるがURLのみ許可する. URLじゃない文字列も考慮する
      var url = null;
      try {
        url = new URL(text);
      } catch (e) {
        codex_notifier__WEBPACK_IMPORTED_MODULE_2___default().show({
          message: "URLが間違っています",
          style: 'error'
        });
        return false;
      }
      //httpsかhttpが入っていなければエラー
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        codex_notifier__WEBPACK_IMPORTED_MODULE_2___default().show({
          message: "正しいURLを入力してください",
          style: 'error'
        });
        return false;
      }
      return true;
    }
  }, {
    key: "defaultTextValidation",
    value: function defaultTextValidation(text) {
      if (text === "") {
        codex_notifier__WEBPACK_IMPORTED_MODULE_2___default().show({
          message: "ボタンのテキストを入力してください",
          style: 'error'
        });
        return false;
      }
      return true;
    }
  }, {
    key: "render",
    value: function render() {
      this.nodes.wrapper = this.make('div', this.CSS.baseClass);
      this.nodes.container = this.make('div', this.CSS.container); //twitter-embed-tool

      //入力用
      this.nodes.inputHolder = this.makeInputHolder();
      //display button
      this.nodes.anyButtonHolder = this.makeAnyButtonHolder();
      this.nodes.container.appendChild(this.nodes.inputHolder);
      this.nodes.container.appendChild(this.nodes.anyButtonHolder);
      if (this._data.link !== "") {
        this.init();
        this.show(AnyButton.STATE.VIEW);
      }
      this.nodes.wrapper.appendChild(this.nodes.container);
      return this.nodes.wrapper;
    }
  }, {
    key: "makeInputHolder",
    value: function makeInputHolder() {
      var _this2 = this;
      var inputHolder = this.make('div', [this.CSS.inputHolder]);
      this.nodes.textInput = this.make('div', [this.api.styles.input, this.CSS.input, this.CSS.inputText], {
        contentEditable: !this.readOnly
      });
      this.nodes.textInput.dataset.placeholder = this.api.i18n.t('Button Text');
      this.nodes.linkInput = this.make('div', [this.api.styles.input, this.CSS.input, this.CSS.inputLink], {
        contentEditable: !this.readOnly
      });
      this.nodes.linkInput.dataset.placeholder = this.api.i18n.t('Link Url');
      this.nodes.registButton = this.make('button', [this.api.styles.button, this.CSS.registButton]);
      this.nodes.registButton.type = 'button';
      this.nodes.registButton.textContent = this.api.i18n.t('Set');
      this.nodes.registButton.addEventListener('click', function (event) {
        if (!_this2.linkValidation(_this2.nodes.linkInput.textContent)) {
          return;
        }
        if (!_this2.textValidation(_this2.nodes.textInput.textContent)) {
          return;
        }
        _this2.data = {
          "link": _this2.nodes.linkInput.textContent,
          "text": _this2.nodes.textInput.textContent
        };
        _this2.show(AnyButton.STATE.VIEW);
      });
      inputHolder.appendChild(this.nodes.textInput);
      inputHolder.appendChild(this.nodes.linkInput);
      inputHolder.appendChild(this.nodes.registButton);
      return inputHolder;
    }
  }, {
    key: "init",
    value: function init() {
      this.nodes.textInput.textContent = this._data.text;
      this.nodes.linkInput.textContent = this._data.link;
    }
  }, {
    key: "show",
    value: function show(state) {
      this.nodes.anyButton.textContent = this._data.text;
      this.nodes.anyButton.setAttribute("href", this._data.link);
      this.changeState(state);
    }
  }, {
    key: "makeAnyButtonHolder",
    value: function makeAnyButtonHolder() {
      var anyButtonHolder = this.make('div', [this.CSS.hide, this.CSS.anyButtonHolder]);
      this.nodes.anyButton = this.make('a', [this.CSS.btn, this.CSS.btnColor], {
        target: '_blank',
        rel: 'nofollow noindex noreferrer'
      });
      this.nodes.anyButton.textContent = this.api.i18n.t("Default Button");
      anyButtonHolder.appendChild(this.nodes.anyButton);
      return anyButtonHolder;
    }
  }, {
    key: "changeState",
    value: function changeState(state) {
      switch (state) {
        case AnyButton.STATE.EDIT:
          this.nodes.inputHolder.classList.remove(this.CSS.hide);
          this.nodes.anyButtonHolder.classList.add(this.CSS.hide);
          break;
        case AnyButton.STATE.VIEW:
          this.nodes.inputHolder.classList.add(this.CSS.hide);
          this.nodes.anyButtonHolder.classList.remove(this.CSS.hide);
          break;
      }
    }

    /**
     * node 作成用
     * @param tagName
     * @param classNames
     * @param attributes
     * @returns {*}
     */
  }, {
    key: "make",
    value: function make(tagName) {
      var classNames = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      var attributes = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var el = document.createElement(tagName);
      if (Array.isArray(classNames)) {
        var _el$classList;
        (_el$classList = el.classList).add.apply(_el$classList, _toConsumableArray(classNames));
      } else if (classNames) {
        el.classList.add(classNames);
      }
      for (var attrName in attributes) {
        el[attrName] = attributes[attrName];
      }
      return el;
    }
  }], [{
    key: "toolbox",
    get:
    /**
     *
     * @returns {{icon: string, title: string}}
     */
    function get() {
      return {
        title: "Button",
        icon: _toolbox_icon_svg__WEBPACK_IMPORTED_MODULE_1__["default"]
      };
    }
  }, {
    key: "tunes",
    get: function get() {
      return [{
        name: 'edit_mode',
        icon: _toolbox_icon_svg__WEBPACK_IMPORTED_MODULE_1__["default"],
        title: 'ボタンを編集'
      }];
    }
  }, {
    key: "isReadOnlySupported",
    get: function get() {
      return true;
    }
    /**
     *
     * @returns {boolean}
     */
  }, {
    key: "enableLineBreaks",
    get: function get() {
      return false;
    }

    /**
     *
     * @returns {{EDIT: number, VIEW: number}}
     * @constructor
     */
  }, {
    key: "STATE",
    get: function get() {
      return {
        EDIT: 0,
        VIEW: 1
      };
    }
  }, {
    key: "sanitize",
    get: function get() {
      return {
        text: false,
        link: false
      };
    }
  }]);
}();

;

/***/ }),

/***/ "./node_modules/codex-notifier/dist/bundle.js":
/*!****************************************************!*\
  !*** ./node_modules/codex-notifier/dist/bundle.js ***!
  \****************************************************/
/***/ ((module) => {

!function(t,e){ true?module.exports=e():0}(window,function(){return function(t){var e={};function n(o){if(e[o])return e[o].exports;var r=e[o]={i:o,l:!1,exports:{}};return t[o].call(r.exports,r,r.exports,n),r.l=!0,r.exports}return n.m=t,n.c=e,n.d=function(t,e,o){n.o(t,e)||Object.defineProperty(t,e,{enumerable:!0,get:o})},n.r=function(t){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})},n.t=function(t,e){if(1&e&&(t=n(t)),8&e)return t;if(4&e&&"object"==typeof t&&t&&t.__esModule)return t;var o=Object.create(null);if(n.r(o),Object.defineProperty(o,"default",{enumerable:!0,value:t}),2&e&&"string"!=typeof t)for(var r in t)n.d(o,r,function(e){return t[e]}.bind(null,r));return o},n.n=function(t){var e=t&&t.__esModule?function(){return t.default}:function(){return t};return n.d(e,"a",e),e},n.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},n.p="/",n(n.s=0)}([function(t,e,n){"use strict";n(1),
/*!
 * Codex JavaScript Notification module
 * https://github.com/codex-team/js-notifier
 */
t.exports=function(){var t=n(6),e="cdx-notify--bounce-in",o=null;return{show:function(n){if(n.message){!function(){if(o)return!0;o=t.getWrapper(),document.body.appendChild(o)}();var r=null,i=n.time||8e3;switch(n.type){case"confirm":r=t.confirm(n);break;case"prompt":r=t.prompt(n);break;default:r=t.alert(n),window.setTimeout(function(){r.remove()},i)}o.appendChild(r),r.classList.add(e)}}}}()},function(t,e,n){var o=n(2);"string"==typeof o&&(o=[[t.i,o,""]]);var r={hmr:!0,transform:void 0,insertInto:void 0};n(4)(o,r);o.locals&&(t.exports=o.locals)},function(t,e,n){(t.exports=n(3)(!1)).push([t.i,'.cdx-notify--error{background:#fffbfb!important}.cdx-notify--error::before{background:#fb5d5d!important}.cdx-notify__input{max-width:130px;padding:5px 10px;background:#f7f7f7;border:0;border-radius:3px;font-size:13px;color:#656b7c;outline:0}.cdx-notify__input:-ms-input-placeholder{color:#656b7c}.cdx-notify__input::placeholder{color:#656b7c}.cdx-notify__input:focus:-ms-input-placeholder{color:rgba(101,107,124,.3)}.cdx-notify__input:focus::placeholder{color:rgba(101,107,124,.3)}.cdx-notify__button{border:none;border-radius:3px;font-size:13px;padding:5px 10px;cursor:pointer}.cdx-notify__button:last-child{margin-left:10px}.cdx-notify__button--cancel{background:#f2f5f7;box-shadow:0 2px 1px 0 rgba(16,19,29,0);color:#656b7c}.cdx-notify__button--cancel:hover{background:#eee}.cdx-notify__button--confirm{background:#34c992;box-shadow:0 1px 1px 0 rgba(18,49,35,.05);color:#fff}.cdx-notify__button--confirm:hover{background:#33b082}.cdx-notify__btns-wrapper{display:-ms-flexbox;display:flex;-ms-flex-flow:row nowrap;flex-flow:row nowrap;margin-top:5px}.cdx-notify__cross{position:absolute;top:5px;right:5px;width:10px;height:10px;padding:5px;opacity:.54;cursor:pointer}.cdx-notify__cross::after,.cdx-notify__cross::before{content:\'\';position:absolute;left:9px;top:5px;height:12px;width:2px;background:#575d67}.cdx-notify__cross::before{transform:rotate(-45deg)}.cdx-notify__cross::after{transform:rotate(45deg)}.cdx-notify__cross:hover{opacity:1}.cdx-notifies{position:fixed;z-index:2;bottom:20px;left:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,Cantarell,"Fira Sans","Droid Sans","Helvetica Neue",sans-serif}.cdx-notify{position:relative;width:220px;margin-top:15px;padding:13px 16px;background:#fff;box-shadow:0 11px 17px 0 rgba(23,32,61,.13);border-radius:5px;font-size:14px;line-height:1.4em;word-wrap:break-word}.cdx-notify::before{content:\'\';position:absolute;display:block;top:0;left:0;width:3px;height:calc(100% - 6px);margin:3px;border-radius:5px;background:0 0}@keyframes bounceIn{0%{opacity:0;transform:scale(.3)}50%{opacity:1;transform:scale(1.05)}70%{transform:scale(.9)}100%{transform:scale(1)}}.cdx-notify--bounce-in{animation-name:bounceIn;animation-duration:.6s;animation-iteration-count:1}.cdx-notify--success{background:#fafffe!important}.cdx-notify--success::before{background:#41ffb1!important}',""])},function(t,e){t.exports=function(t){var e=[];return e.toString=function(){return this.map(function(e){var n=function(t,e){var n=t[1]||"",o=t[3];if(!o)return n;if(e&&"function"==typeof btoa){var r=(a=o,"/*# sourceMappingURL=data:application/json;charset=utf-8;base64,"+btoa(unescape(encodeURIComponent(JSON.stringify(a))))+" */"),i=o.sources.map(function(t){return"/*# sourceURL="+o.sourceRoot+t+" */"});return[n].concat(i).concat([r]).join("\n")}var a;return[n].join("\n")}(e,t);return e[2]?"@media "+e[2]+"{"+n+"}":n}).join("")},e.i=function(t,n){"string"==typeof t&&(t=[[null,t,""]]);for(var o={},r=0;r<this.length;r++){var i=this[r][0];"number"==typeof i&&(o[i]=!0)}for(r=0;r<t.length;r++){var a=t[r];"number"==typeof a[0]&&o[a[0]]||(n&&!a[2]?a[2]=n:n&&(a[2]="("+a[2]+") and ("+n+")"),e.push(a))}},e}},function(t,e,n){var o,r,i={},a=(o=function(){return window&&document&&document.all&&!window.atob},function(){return void 0===r&&(r=o.apply(this,arguments)),r}),c=function(t){var e={};return function(t){if("function"==typeof t)return t();if(void 0===e[t]){var n=function(t){return document.querySelector(t)}.call(this,t);if(window.HTMLIFrameElement&&n instanceof window.HTMLIFrameElement)try{n=n.contentDocument.head}catch(t){n=null}e[t]=n}return e[t]}}(),s=null,f=0,d=[],u=n(5);function l(t,e){for(var n=0;n<t.length;n++){var o=t[n],r=i[o.id];if(r){r.refs++;for(var a=0;a<r.parts.length;a++)r.parts[a](o.parts[a]);for(;a<o.parts.length;a++)r.parts.push(h(o.parts[a],e))}else{var c=[];for(a=0;a<o.parts.length;a++)c.push(h(o.parts[a],e));i[o.id]={id:o.id,refs:1,parts:c}}}}function p(t,e){for(var n=[],o={},r=0;r<t.length;r++){var i=t[r],a=e.base?i[0]+e.base:i[0],c={css:i[1],media:i[2],sourceMap:i[3]};o[a]?o[a].parts.push(c):n.push(o[a]={id:a,parts:[c]})}return n}function b(t,e){var n=c(t.insertInto);if(!n)throw new Error("Couldn't find a style target. This probably means that the value for the 'insertInto' parameter is invalid.");var o=d[d.length-1];if("top"===t.insertAt)o?o.nextSibling?n.insertBefore(e,o.nextSibling):n.appendChild(e):n.insertBefore(e,n.firstChild),d.push(e);else if("bottom"===t.insertAt)n.appendChild(e);else{if("object"!=typeof t.insertAt||!t.insertAt.before)throw new Error("[Style Loader]\n\n Invalid value for parameter 'insertAt' ('options.insertAt') found.\n Must be 'top', 'bottom', or Object.\n (https://github.com/webpack-contrib/style-loader#insertat)\n");var r=c(t.insertInto+" "+t.insertAt.before);n.insertBefore(e,r)}}function m(t){if(null===t.parentNode)return!1;t.parentNode.removeChild(t);var e=d.indexOf(t);e>=0&&d.splice(e,1)}function x(t){var e=document.createElement("style");return void 0===t.attrs.type&&(t.attrs.type="text/css"),y(e,t.attrs),b(t,e),e}function y(t,e){Object.keys(e).forEach(function(n){t.setAttribute(n,e[n])})}function h(t,e){var n,o,r,i;if(e.transform&&t.css){if(!(i=e.transform(t.css)))return function(){};t.css=i}if(e.singleton){var a=f++;n=s||(s=x(e)),o=_.bind(null,n,a,!1),r=_.bind(null,n,a,!0)}else t.sourceMap&&"function"==typeof URL&&"function"==typeof URL.createObjectURL&&"function"==typeof URL.revokeObjectURL&&"function"==typeof Blob&&"function"==typeof btoa?(n=function(t){var e=document.createElement("link");return void 0===t.attrs.type&&(t.attrs.type="text/css"),t.attrs.rel="stylesheet",y(e,t.attrs),b(t,e),e}(e),o=function(t,e,n){var o=n.css,r=n.sourceMap,i=void 0===e.convertToAbsoluteUrls&&r;(e.convertToAbsoluteUrls||i)&&(o=u(o));r&&(o+="\n/*# sourceMappingURL=data:application/json;base64,"+btoa(unescape(encodeURIComponent(JSON.stringify(r))))+" */");var a=new Blob([o],{type:"text/css"}),c=t.href;t.href=URL.createObjectURL(a),c&&URL.revokeObjectURL(c)}.bind(null,n,e),r=function(){m(n),n.href&&URL.revokeObjectURL(n.href)}):(n=x(e),o=function(t,e){var n=e.css,o=e.media;o&&t.setAttribute("media",o);if(t.styleSheet)t.styleSheet.cssText=n;else{for(;t.firstChild;)t.removeChild(t.firstChild);t.appendChild(document.createTextNode(n))}}.bind(null,n),r=function(){m(n)});return o(t),function(e){if(e){if(e.css===t.css&&e.media===t.media&&e.sourceMap===t.sourceMap)return;o(t=e)}else r()}}t.exports=function(t,e){if("undefined"!=typeof DEBUG&&DEBUG&&"object"!=typeof document)throw new Error("The style-loader cannot be used in a non-browser environment");(e=e||{}).attrs="object"==typeof e.attrs?e.attrs:{},e.singleton||"boolean"==typeof e.singleton||(e.singleton=a()),e.insertInto||(e.insertInto="head"),e.insertAt||(e.insertAt="bottom");var n=p(t,e);return l(n,e),function(t){for(var o=[],r=0;r<n.length;r++){var a=n[r];(c=i[a.id]).refs--,o.push(c)}t&&l(p(t,e),e);for(r=0;r<o.length;r++){var c;if(0===(c=o[r]).refs){for(var s=0;s<c.parts.length;s++)c.parts[s]();delete i[c.id]}}}};var v,g=(v=[],function(t,e){return v[t]=e,v.filter(Boolean).join("\n")});function _(t,e,n,o){var r=n?"":o.css;if(t.styleSheet)t.styleSheet.cssText=g(e,r);else{var i=document.createTextNode(r),a=t.childNodes;a[e]&&t.removeChild(a[e]),a.length?t.insertBefore(i,a[e]):t.appendChild(i)}}},function(t,e){t.exports=function(t){var e="undefined"!=typeof window&&window.location;if(!e)throw new Error("fixUrls requires window.location");if(!t||"string"!=typeof t)return t;var n=e.protocol+"//"+e.host,o=n+e.pathname.replace(/\/[^\/]*$/,"/");return t.replace(/url\s*\(((?:[^)(]|\((?:[^)(]+|\([^)(]*\))*\))*)\)/gi,function(t,e){var r,i=e.trim().replace(/^"(.*)"$/,function(t,e){return e}).replace(/^'(.*)'$/,function(t,e){return e});return/^(#|data:|http:\/\/|https:\/\/|file:\/\/\/|\s*$)/i.test(i)?t:(r=0===i.indexOf("//")?i:0===i.indexOf("/")?n+i:o+i.replace(/^\.\//,""),"url("+JSON.stringify(r)+")")})}},function(t,e,n){"use strict";var o,r,i,a,c,s,f,d,u;t.exports=(o="cdx-notifies",r="cdx-notify",i="cdx-notify__cross",a="cdx-notify__button--confirm",c="cdx-notify__button--cancel",s="cdx-notify__input",f="cdx-notify__button",d="cdx-notify__btns-wrapper",{alert:u=function(t){var e=document.createElement("DIV"),n=document.createElement("DIV"),o=t.message,a=t.style;return e.classList.add(r),a&&e.classList.add(r+"--"+a),e.innerHTML=o,n.classList.add(i),n.addEventListener("click",e.remove.bind(e)),e.appendChild(n),e},confirm:function(t){var e=u(t),n=document.createElement("div"),o=document.createElement("button"),r=document.createElement("button"),s=e.querySelector("."+i),l=t.cancelHandler,p=t.okHandler;return n.classList.add(d),o.innerHTML=t.okText||"Confirm",r.innerHTML=t.cancelText||"Cancel",o.classList.add(f),r.classList.add(f),o.classList.add(a),r.classList.add(c),l&&"function"==typeof l&&(r.addEventListener("click",l),s.addEventListener("click",l)),p&&"function"==typeof p&&o.addEventListener("click",p),o.addEventListener("click",e.remove.bind(e)),r.addEventListener("click",e.remove.bind(e)),n.appendChild(o),n.appendChild(r),e.appendChild(n),e},prompt:function(t){var e=u(t),n=document.createElement("div"),o=document.createElement("button"),r=document.createElement("input"),c=e.querySelector("."+i),l=t.cancelHandler,p=t.okHandler;return n.classList.add(d),o.innerHTML=t.okText||"Ok",o.classList.add(f),o.classList.add(a),r.classList.add(s),t.placeholder&&r.setAttribute("placeholder",t.placeholder),t.default&&(r.value=t.default),t.inputType&&(r.type=t.inputType),l&&"function"==typeof l&&c.addEventListener("click",l),p&&"function"==typeof p&&o.addEventListener("click",function(){p(r.value)}),o.addEventListener("click",e.remove.bind(e)),n.appendChild(r),n.appendChild(o),e.appendChild(n),e},getWrapper:function(){var t=document.createElement("DIV");return t.classList.add(o),t}})}])});
;

/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs.js!./src/index.scss":
/*!*****************************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs.js!./src/index.scss ***!
  \*****************************************************************************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../node_modules/css-loader/dist/runtime/noSourceMaps.js */ "./node_modules/css-loader/dist/runtime/noSourceMaps.js");
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_getUrl_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../node_modules/css-loader/dist/runtime/getUrl.js */ "./node_modules/css-loader/dist/runtime/getUrl.js");
/* harmony import */ var _node_modules_css_loader_dist_runtime_getUrl_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_getUrl_js__WEBPACK_IMPORTED_MODULE_2__);
// Imports



var ___CSS_LOADER_URL_IMPORT_0___ = new URL(/* asset import */ __webpack_require__(/*! data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"> <path d="M7.69998 12.6L7.67896 12.62C6.53993 13.7048 6.52012 15.5155 7.63516 16.625V16.625C8.72293 17.7073 10.4799 17.7102 11.5712 16.6314L13.0263 15.193C14.0703 14.1609 14.2141 12.525 13.3662 11.3266L13.22 11.12" stroke="black" stroke-width="2" stroke-linecap="round"/> <path d="M16.22 11.12L16.3564 10.9805C17.2895 10.0265 17.3478 8.5207 16.4914 7.49733V7.49733C15.5691 6.39509 13.9269 6.25143 12.8271 7.17675L11.3901 8.38588C10.0935 9.47674 9.95706 11.4241 11.0888 12.6852L11.12 12.72" stroke="black" stroke-width="2" stroke-linecap="round"/> </svg> */ "data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\"> <path d=\"M7.69998 12.6L7.67896 12.62C6.53993 13.7048 6.52012 15.5155 7.63516 16.625V16.625C8.72293 17.7073 10.4799 17.7102 11.5712 16.6314L13.0263 15.193C14.0703 14.1609 14.2141 12.525 13.3662 11.3266L13.22 11.12\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\"/> <path d=\"M16.22 11.12L16.3564 10.9805C17.2895 10.0265 17.3478 8.5207 16.4914 7.49733V7.49733C15.5691 6.39509 13.9269 6.25143 12.8271 7.17675L11.3901 8.38588C10.0935 9.47674 9.95706 11.4241 11.0888 12.6852L11.12 12.72\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\"/> </svg>"), __webpack_require__.b);
var ___CSS_LOADER_URL_IMPORT_1___ = new URL(/* asset import */ __webpack_require__(/*! data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"> <path d="M8 9V7.2C8 7.08954 8.08954 7 8.2 7L12 7M16 9V7.2C16 7.08954 15.9105 7 15.8 7L12 7M12 7L12 17M12 17H10M12 17H14" stroke="black" stroke-width="2" stroke-linecap="round"/> </svg> */ "data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\"> <path d=\"M8 9V7.2C8 7.08954 8.08954 7 8.2 7L12 7M16 9V7.2C16 7.08954 15.9105 7 15.8 7L12 7M12 7L12 17M12 17H10M12 17H14\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\"/> </svg>"), __webpack_require__.b);
var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
var ___CSS_LOADER_URL_REPLACEMENT_0___ = _node_modules_css_loader_dist_runtime_getUrl_js__WEBPACK_IMPORTED_MODULE_2___default()(___CSS_LOADER_URL_IMPORT_0___);
var ___CSS_LOADER_URL_REPLACEMENT_1___ = _node_modules_css_loader_dist_runtime_getUrl_js__WEBPACK_IMPORTED_MODULE_2___default()(___CSS_LOADER_URL_IMPORT_1___);
// Module
___CSS_LOADER_EXPORT___.push([module.id, `.hide {
  display: none !important;
}

.anyButtonContainer {
  position: relative;
}

.anyButtonContainer__registerButton {
  display: block;
  margin: auto;
}

.anyButtonContainer__inputHolder > * {
  margin-bottom: 10px;
}

.anyButtonContainer__input {
  padding-left: 38px;
  background-repeat: no-repeat;
  background-position: 10px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.anyButtonContainer__input--link {
  background-image: url(${___CSS_LOADER_URL_REPLACEMENT_0___});
}

.anyButtonContainer__input--text {
  background-image: url(${___CSS_LOADER_URL_REPLACEMENT_1___});
}

.anyButtonContainer__input[contentEditable=true][data-placeholder]::before {
  position: absolute;
  content: attr(data-placeholder);
  color: #707684;
  font-weight: normal;
  opacity: 0;
}

.anyButtonContainer__input[contentEditable=true][data-placeholder]:empty::before {
  opacity: 1;
}

.anyButtonContainer__input[contentEditable=true][data-placeholder]:empty:focus::before {
  opacity: 0;
}

.cdx-button {
  white-space: nowrap;
}

.anyButtonContainer__anyButtonHolder {
  text-align: center;
}

.anyButton__btn {
  display: inline-block;
  font-weight: 400;
  line-height: 1.5;
  color: #212529;
  text-align: center;
  text-decoration: none !important;
  vertical-align: middle;
  cursor: pointer;
  -webkit-user-select: none;
  -moz-user-select: none;
  user-select: none;
  background-color: transparent;
  border: 1px solid transparent;
  padding: 0.375rem 0.75rem;
  font-size: 1rem;
  border-radius: 0.25rem;
  transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  word-break: break-all;
  overflow-wrap: break-word;
}
.anyButton__btn--default {
  color: #fff;
  background-color: #0d6efd;
  border-color: #0d6efd;
}
.anyButton__btn--gray {
  color: #fff;
  background-color: #7c7c7c;
  border-color: #7c7c7c;
}

.toggle-input {
  position: absolute;
  z-index: 5;
  opacity: 0;
  cursor: pointer;
  width: 40px;
  height: 20px;
  margin: 0;
}

.toggle-label {
  width: 40px;
  height: 20px;
  background: #ccc;
  position: relative;
  display: inline-block;
  border-radius: 46px;
  transition: 0.4s;
  box-sizing: border-box;
}

.toggle-label:after {
  content: "";
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 100%;
  left: 0;
  top: 0;
  z-index: 2;
  background: #fff;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
  transition: 0.4s;
}

.toggle-input:checked + .toggle-label {
  background-color: #4BD865;
}

.toggle-input:checked + .toggle-label:after {
  left: 20px;
}

.toggle-switch {
  width: 40px;
  margin-left: auto;
  padding: 10px 0;
}`, ""]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);

;

/***/ }),

/***/ "./node_modules/css-loader/dist/runtime/api.js":
/*!*****************************************************!*\
  !*** ./node_modules/css-loader/dist/runtime/api.js ***!
  \*****************************************************/
/***/ ((module) => {

"use strict";


/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
module.exports = function (cssWithMappingToString) {
  var list = [];

  // return the list of modules as css string
  list.toString = function toString() {
    return this.map(function (item) {
      var content = "";
      var needLayer = typeof item[5] !== "undefined";
      if (item[4]) {
        content += "@supports (".concat(item[4], ") {");
      }
      if (item[2]) {
        content += "@media ".concat(item[2], " {");
      }
      if (needLayer) {
        content += "@layer".concat(item[5].length > 0 ? " ".concat(item[5]) : "", " {");
      }
      content += cssWithMappingToString(item);
      if (needLayer) {
        content += "}";
      }
      if (item[2]) {
        content += "}";
      }
      if (item[4]) {
        content += "}";
      }
      return content;
    }).join("");
  };

  // import a list of modules into the list
  list.i = function i(modules, media, dedupe, supports, layer) {
    if (typeof modules === "string") {
      modules = [[null, modules, undefined]];
    }
    var alreadyImportedModules = {};
    if (dedupe) {
      for (var k = 0; k < this.length; k++) {
        var id = this[k][0];
        if (id != null) {
          alreadyImportedModules[id] = true;
        }
      }
    }
    for (var _k = 0; _k < modules.length; _k++) {
      var item = [].concat(modules[_k]);
      if (dedupe && alreadyImportedModules[item[0]]) {
        continue;
      }
      if (typeof layer !== "undefined") {
        if (typeof item[5] === "undefined") {
          item[5] = layer;
        } else {
          item[1] = "@layer".concat(item[5].length > 0 ? " ".concat(item[5]) : "", " {").concat(item[1], "}");
          item[5] = layer;
        }
      }
      if (media) {
        if (!item[2]) {
          item[2] = media;
        } else {
          item[1] = "@media ".concat(item[2], " {").concat(item[1], "}");
          item[2] = media;
        }
      }
      if (supports) {
        if (!item[4]) {
          item[4] = "".concat(supports);
        } else {
          item[1] = "@supports (".concat(item[4], ") {").concat(item[1], "}");
          item[4] = supports;
        }
      }
      list.push(item);
    }
  };
  return list;
};
;

/***/ }),

/***/ "./node_modules/css-loader/dist/runtime/getUrl.js":
/*!********************************************************!*\
  !*** ./node_modules/css-loader/dist/runtime/getUrl.js ***!
  \********************************************************/
/***/ ((module) => {

"use strict";


module.exports = function (url, options) {
  if (!options) {
    options = {};
  }
  if (!url) {
    return url;
  }
  url = String(url.__esModule ? url.default : url);

  // If url is already wrapped in quotes, remove them
  if (/^['"].*['"]$/.test(url)) {
    url = url.slice(1, -1);
  }
  if (options.hash) {
    url += options.hash;
  }

  // Should url be wrapped?
  // See https://drafts.csswg.org/css-values-3/#urls
  if (/["'() \t\n]|(%20)/.test(url) || options.needQuotes) {
    return "\"".concat(url.replace(/"/g, '\\"').replace(/\n/g, "\\n"), "\"");
  }
  return url;
};
;

/***/ }),

/***/ "./node_modules/css-loader/dist/runtime/noSourceMaps.js":
/*!**************************************************************!*\
  !*** ./node_modules/css-loader/dist/runtime/noSourceMaps.js ***!
  \**************************************************************/
/***/ ((module) => {

"use strict";


module.exports = function (i) {
  return i[1];
};
;

/***/ }),

/***/ "./src/toolbox-icon.svg":
/*!******************************!*\
  !*** ./src/toolbox-icon.svg ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"36\" height=\"36\" viewBox=\"0 0 36 36\" fill=\"none\">\n  <rect x=\"9\" y=\"9\" width=\"18\" height=\"18\" rx=\"3\" fill=\"black\"/>\n  <path d=\"M25 16.2966H20.8875C20.8583 15.9861 20.7806 15.7044 20.6542 15.4515C20.5326 15.1987 20.3625 14.9813 20.1438 14.7994C19.9299 14.6131 19.6698 14.4712 19.3635 14.3736C19.0573 14.2715 18.7097 14.2205 18.3208 14.2205C17.6403 14.2205 17.0642 14.3714 16.5927 14.673C16.126 14.9747 15.7712 15.4072 15.5281 15.9705C15.2899 16.5339 15.1708 17.2104 15.1708 18C15.1708 18.834 15.2924 19.5326 15.5354 20.096C15.7833 20.6549 16.1406 21.0764 16.6073 21.3603C17.074 21.6397 17.6354 21.7795 18.2917 21.7795C18.666 21.7795 19.0014 21.7373 19.2979 21.653C19.5944 21.5643 19.8521 21.4379 20.0708 21.2738C20.2896 21.1096 20.467 20.9122 20.6031 20.6816C20.7441 20.4465 20.8389 20.1825 20.8875 19.8897L25 19.9163C24.9514 20.493 24.774 21.0808 24.4677 21.6797C24.1615 22.2741 23.7264 22.8241 23.1625 23.3298C22.6035 23.8311 21.9108 24.2348 21.0844 24.5409C20.258 24.847 19.2979 25 18.2042 25C16.8333 25 15.6035 24.7316 14.5146 24.1949C13.4306 23.6581 12.5726 22.8685 11.9406 21.826C11.3135 20.7836 11 19.5082 11 18C11 16.4829 11.3208 15.2053 11.9625 14.1673C12.6042 13.1248 13.4694 12.3375 14.5583 11.8051C15.6472 11.2684 16.8625 11 18.2042 11C19.1472 11 20.0149 11.1176 20.8073 11.3527C21.5997 11.5878 22.2948 11.9316 22.8927 12.384C23.4906 12.8321 23.9719 13.3843 24.3365 14.0409C24.701 14.6974 24.9222 15.4493 25 16.2966Z\" fill=\"white\"/>\n</svg>");
;

/***/ }),

/***/ "./src/index.scss":
/*!************************!*\
  !*** ./src/index.scss ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/styleDomAPI.js */ "./node_modules/style-loader/dist/runtime/styleDomAPI.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/insertBySelector.js */ "./node_modules/style-loader/dist/runtime/insertBySelector.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js */ "./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/insertStyleElement.js */ "./node_modules/style-loader/dist/runtime/insertStyleElement.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/styleTagTransform.js */ "./node_modules/style-loader/dist/runtime/styleTagTransform.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_sass_loader_dist_cjs_js_index_scss__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! !!../node_modules/css-loader/dist/cjs.js!../node_modules/sass-loader/dist/cjs.js!./index.scss */ "./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs.js!./src/index.scss");

      
      
      
      
      
      
      
      
      

var options = {};

options.styleTagTransform = (_node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5___default());
options.setAttributes = (_node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3___default());
options.insert = _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2___default().bind(null, "head");
options.domAPI = (_node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1___default());
options.insertStyleElement = (_node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4___default());

var update = _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()(_node_modules_css_loader_dist_cjs_js_node_modules_sass_loader_dist_cjs_js_index_scss__WEBPACK_IMPORTED_MODULE_6__["default"], options);




       /* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (_node_modules_css_loader_dist_cjs_js_node_modules_sass_loader_dist_cjs_js_index_scss__WEBPACK_IMPORTED_MODULE_6__["default"] && _node_modules_css_loader_dist_cjs_js_node_modules_sass_loader_dist_cjs_js_index_scss__WEBPACK_IMPORTED_MODULE_6__["default"].locals ? _node_modules_css_loader_dist_cjs_js_node_modules_sass_loader_dist_cjs_js_index_scss__WEBPACK_IMPORTED_MODULE_6__["default"].locals : undefined);

;

/***/ }),

/***/ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js":
/*!****************************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js ***!
  \****************************************************************************/
/***/ ((module) => {

"use strict";


var stylesInDOM = [];
function getIndexByIdentifier(identifier) {
  var result = -1;
  for (var i = 0; i < stylesInDOM.length; i++) {
    if (stylesInDOM[i].identifier === identifier) {
      result = i;
      break;
    }
  }
  return result;
}
function modulesToDom(list, options) {
  var idCountMap = {};
  var identifiers = [];
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var id = options.base ? item[0] + options.base : item[0];
    var count = idCountMap[id] || 0;
    var identifier = "".concat(id, " ").concat(count);
    idCountMap[id] = count + 1;
    var indexByIdentifier = getIndexByIdentifier(identifier);
    var obj = {
      css: item[1],
      media: item[2],
      sourceMap: item[3],
      supports: item[4],
      layer: item[5]
    };
    if (indexByIdentifier !== -1) {
      stylesInDOM[indexByIdentifier].references++;
      stylesInDOM[indexByIdentifier].updater(obj);
    } else {
      var updater = addElementStyle(obj, options);
      options.byIndex = i;
      stylesInDOM.splice(i, 0, {
        identifier: identifier,
        updater: updater,
        references: 1
      });
    }
    identifiers.push(identifier);
  }
  return identifiers;
}
function addElementStyle(obj, options) {
  var api = options.domAPI(options);
  api.update(obj);
  var updater = function updater(newObj) {
    if (newObj) {
      if (newObj.css === obj.css && newObj.media === obj.media && newObj.sourceMap === obj.sourceMap && newObj.supports === obj.supports && newObj.layer === obj.layer) {
        return;
      }
      api.update(obj = newObj);
    } else {
      api.remove();
    }
  };
  return updater;
}
module.exports = function (list, options) {
  options = options || {};
  list = list || [];
  var lastIdentifiers = modulesToDom(list, options);
  return function update(newList) {
    newList = newList || [];
    for (var i = 0; i < lastIdentifiers.length; i++) {
      var identifier = lastIdentifiers[i];
      var index = getIndexByIdentifier(identifier);
      stylesInDOM[index].references--;
    }
    var newLastIdentifiers = modulesToDom(newList, options);
    for (var _i = 0; _i < lastIdentifiers.length; _i++) {
      var _identifier = lastIdentifiers[_i];
      var _index = getIndexByIdentifier(_identifier);
      if (stylesInDOM[_index].references === 0) {
        stylesInDOM[_index].updater();
        stylesInDOM.splice(_index, 1);
      }
    }
    lastIdentifiers = newLastIdentifiers;
  };
};
;

/***/ }),

/***/ "./node_modules/style-loader/dist/runtime/insertBySelector.js":
/*!********************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/insertBySelector.js ***!
  \********************************************************************/
/***/ ((module) => {

"use strict";


var memo = {};

/* istanbul ignore next  */
function getTarget(target) {
  if (typeof memo[target] === "undefined") {
    var styleTarget = document.querySelector(target);

    // Special case to return head of iframe instead of iframe itself
    if (window.HTMLIFrameElement && styleTarget instanceof window.HTMLIFrameElement) {
      try {
        // This will throw an exception if access to iframe is blocked
        // due to cross-origin restrictions
        styleTarget = styleTarget.contentDocument.head;
      } catch (e) {
        // istanbul ignore next
        styleTarget = null;
      }
    }
    memo[target] = styleTarget;
  }
  return memo[target];
}

/* istanbul ignore next  */
function insertBySelector(insert, style) {
  var target = getTarget(insert);
  if (!target) {
    throw new Error("Couldn't find a style target. This probably means that the value for the 'insert' parameter is invalid.");
  }
  target.appendChild(style);
}
module.exports = insertBySelector;
;

/***/ }),

/***/ "./node_modules/style-loader/dist/runtime/insertStyleElement.js":
/*!**********************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/insertStyleElement.js ***!
  \**********************************************************************/
/***/ ((module) => {

"use strict";


/* istanbul ignore next  */
function insertStyleElement(options) {
  var element = document.createElement("style");
  options.setAttributes(element, options.attributes);
  options.insert(element, options.options);
  return element;
}
module.exports = insertStyleElement;
;

/***/ }),

/***/ "./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js":
/*!**********************************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js ***!
  \**********************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


/* istanbul ignore next  */
function setAttributesWithoutAttributes(styleElement) {
  var nonce =  true ? __webpack_require__.nc : 0;
  if (nonce) {
    styleElement.setAttribute("nonce", nonce);
  }
}
module.exports = setAttributesWithoutAttributes;
;

/***/ }),

/***/ "./node_modules/style-loader/dist/runtime/styleDomAPI.js":
/*!***************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/styleDomAPI.js ***!
  \***************************************************************/
/***/ ((module) => {

"use strict";


/* istanbul ignore next  */
function apply(styleElement, options, obj) {
  var css = "";
  if (obj.supports) {
    css += "@supports (".concat(obj.supports, ") {");
  }
  if (obj.media) {
    css += "@media ".concat(obj.media, " {");
  }
  var needLayer = typeof obj.layer !== "undefined";
  if (needLayer) {
    css += "@layer".concat(obj.layer.length > 0 ? " ".concat(obj.layer) : "", " {");
  }
  css += obj.css;
  if (needLayer) {
    css += "}";
  }
  if (obj.media) {
    css += "}";
  }
  if (obj.supports) {
    css += "}";
  }
  var sourceMap = obj.sourceMap;
  if (sourceMap && typeof btoa !== "undefined") {
    css += "\n/*# sourceMappingURL=data:application/json;base64,".concat(btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap)))), " */");
  }

  // For old IE
  /* istanbul ignore if  */
  options.styleTagTransform(css, styleElement, options.options);
}
function removeStyleElement(styleElement) {
  // istanbul ignore if
  if (styleElement.parentNode === null) {
    return false;
  }
  styleElement.parentNode.removeChild(styleElement);
}

/* istanbul ignore next  */
function domAPI(options) {
  if (typeof document === "undefined") {
    return {
      update: function update() {},
      remove: function remove() {}
    };
  }
  var styleElement = options.insertStyleElement(options);
  return {
    update: function update(obj) {
      apply(styleElement, options, obj);
    },
    remove: function remove() {
      removeStyleElement(styleElement);
    }
  };
}
module.exports = domAPI;
;

/***/ }),

/***/ "./node_modules/style-loader/dist/runtime/styleTagTransform.js":
/*!*********************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/styleTagTransform.js ***!
  \*********************************************************************/
/***/ ((module) => {

"use strict";


/* istanbul ignore next  */
function styleTagTransform(css, styleElement) {
  if (styleElement.styleSheet) {
    styleElement.styleSheet.cssText = css;
  } else {
    while (styleElement.firstChild) {
      styleElement.removeChild(styleElement.firstChild);
    }
    styleElement.appendChild(document.createTextNode(css));
  }
}
module.exports = styleTagTransform;
;

/***/ }),

/***/ "data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\"> <path d=\"M7.69998 12.6L7.67896 12.62C6.53993 13.7048 6.52012 15.5155 7.63516 16.625V16.625C8.72293 17.7073 10.4799 17.7102 11.5712 16.6314L13.0263 15.193C14.0703 14.1609 14.2141 12.525 13.3662 11.3266L13.22 11.12\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\"/> <path d=\"M16.22 11.12L16.3564 10.9805C17.2895 10.0265 17.3478 8.5207 16.4914 7.49733V7.49733C15.5691 6.39509 13.9269 6.25143 12.8271 7.17675L11.3901 8.38588C10.0935 9.47674 9.95706 11.4241 11.0888 12.6852L11.12 12.72\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\"/> </svg>":
/*!***************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"> <path d="M7.69998 12.6L7.67896 12.62C6.53993 13.7048 6.52012 15.5155 7.63516 16.625V16.625C8.72293 17.7073 10.4799 17.7102 11.5712 16.6314L13.0263 15.193C14.0703 14.1609 14.2141 12.525 13.3662 11.3266L13.22 11.12" stroke="black" stroke-width="2" stroke-linecap="round"/> <path d="M16.22 11.12L16.3564 10.9805C17.2895 10.0265 17.3478 8.5207 16.4914 7.49733V7.49733C15.5691 6.39509 13.9269 6.25143 12.8271 7.17675L11.3901 8.38588C10.0935 9.47674 9.95706 11.4241 11.0888 12.6852L11.12 12.72" stroke="black" stroke-width="2" stroke-linecap="round"/> </svg> ***!
  \***************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = "data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\"> <path d=\"M7.69998 12.6L7.67896 12.62C6.53993 13.7048 6.52012 15.5155 7.63516 16.625V16.625C8.72293 17.7073 10.4799 17.7102 11.5712 16.6314L13.0263 15.193C14.0703 14.1609 14.2141 12.525 13.3662 11.3266L13.22 11.12\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\"/> <path d=\"M16.22 11.12L16.3564 10.9805C17.2895 10.0265 17.3478 8.5207 16.4914 7.49733V7.49733C15.5691 6.39509 13.9269 6.25143 12.8271 7.17675L11.3901 8.38588C10.0935 9.47674 9.95706 11.4241 11.0888 12.6852L11.12 12.72\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\"/> </svg>";
;

/***/ }),

/***/ "data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\"> <path d=\"M8 9V7.2C8 7.08954 8.08954 7 8.2 7L12 7M16 9V7.2C16 7.08954 15.9105 7 15.8 7L12 7M12 7L12 17M12 17H10M12 17H14\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\"/> </svg>":
/*!*******************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"> <path d="M8 9V7.2C8 7.08954 8.08954 7 8.2 7L12 7M16 9V7.2C16 7.08954 15.9105 7 15.8 7L12 7M12 7L12 17M12 17H10M12 17H14" stroke="black" stroke-width="2" stroke-linecap="round"/> </svg> ***!
  \*******************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = "data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\"> <path d=\"M8 9V7.2C8 7.08954 8.08954 7 8.2 7L12 7M16 9V7.2C16 7.08954 15.9105 7 15.8 7L12 7M12 7L12 17M12 17H10M12 17H14\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\"/> </svg>";
;

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			id: moduleId,
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/jsonp chunk loading */
/******/ 	(() => {
/******/ 		__webpack_require__.b = document.baseURI || self.location.href;
/******/ 		
/******/ 		// object to store loaded and loading chunks
/******/ 		// undefined = chunk not loaded, null = chunk preloaded/prefetched
/******/ 		// [resolve, reject, Promise] = chunk loading, 0 = chunk loaded
/******/ 		var installedChunks = {
/******/ 			"main": 0
/******/ 		};
/******/ 		
/******/ 		// no chunk on demand loading
/******/ 		
/******/ 		// no prefetching
/******/ 		
/******/ 		// no preloaded
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 		
/******/ 		// no on chunks loaded
/******/ 		
/******/ 		// no jsonp function
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/nonce */
/******/ 	(() => {
/******/ 		__webpack_require__.nc = undefined;
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./src/index.js");
/******/ 	__webpack_exports__ = __webpack_exports__["default"];
/******/ 	
/******/ 	return __webpack_exports__;
/******/ })()
;
});