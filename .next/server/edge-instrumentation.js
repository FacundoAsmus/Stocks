// runtime can't be in strict mode because a global variable is assign and maybe created.
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(self["webpackChunk_N_E"] = self["webpackChunk_N_E"] || []).push([["instrumentation"],{

/***/ "(instrument)/./instrumentation.ts":
/*!****************************!*\
  !*** ./instrumentation.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   register: () => (/* binding */ register)\n/* harmony export */ });\n// Runs once when the Next.js server process starts.\n// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation\nasync function register() {\n    // On some Windows machines, Node's fetch (undici) tries the IPv6 address\n    // of a host first. If the system's IPv6 route is broken or unusably slow,\n    // every outbound fetch (e.g. to Yahoo Finance) hangs for the full request\n    // timeout before failing, even though the host is reachable over IPv4\n    // (e.g. in a browser). Forcing IPv4-first DNS resolution for this Node\n    // process avoids that hang. This only runs server-side, so it's safe to\n    // import \"dns\" here.\n    if (false) {}\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGluc3RydW1lbnQpLy4vaW5zdHJ1bWVudGF0aW9uLnRzIiwibWFwcGluZ3MiOiI7Ozs7QUFBQSxvREFBb0Q7QUFDcEQsd0ZBQXdGO0FBRWpGLGVBQWVBO0lBQ3BCLHlFQUF5RTtJQUN6RSwwRUFBMEU7SUFDMUUsMEVBQTBFO0lBQzFFLHNFQUFzRTtJQUN0RSx1RUFBdUU7SUFDdkUsd0VBQXdFO0lBQ3hFLHFCQUFxQjtJQUNyQixJQUFJQyxLQUFxQyxFQUFFLEVBRzFDO0FBQ0giLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcZmFjdW5cXERlc2t0b3BcXFZTQ09ERVxcU3RvY2tzXFxpbnN0cnVtZW50YXRpb24udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gUnVucyBvbmNlIHdoZW4gdGhlIE5leHQuanMgc2VydmVyIHByb2Nlc3Mgc3RhcnRzLlxuLy8gU2VlOiBodHRwczovL25leHRqcy5vcmcvZG9jcy9hcHAvYnVpbGRpbmcteW91ci1hcHBsaWNhdGlvbi9vcHRpbWl6aW5nL2luc3RydW1lbnRhdGlvblxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVnaXN0ZXIoKSB7XG4gIC8vIE9uIHNvbWUgV2luZG93cyBtYWNoaW5lcywgTm9kZSdzIGZldGNoICh1bmRpY2kpIHRyaWVzIHRoZSBJUHY2IGFkZHJlc3NcbiAgLy8gb2YgYSBob3N0IGZpcnN0LiBJZiB0aGUgc3lzdGVtJ3MgSVB2NiByb3V0ZSBpcyBicm9rZW4gb3IgdW51c2FibHkgc2xvdyxcbiAgLy8gZXZlcnkgb3V0Ym91bmQgZmV0Y2ggKGUuZy4gdG8gWWFob28gRmluYW5jZSkgaGFuZ3MgZm9yIHRoZSBmdWxsIHJlcXVlc3RcbiAgLy8gdGltZW91dCBiZWZvcmUgZmFpbGluZywgZXZlbiB0aG91Z2ggdGhlIGhvc3QgaXMgcmVhY2hhYmxlIG92ZXIgSVB2NFxuICAvLyAoZS5nLiBpbiBhIGJyb3dzZXIpLiBGb3JjaW5nIElQdjQtZmlyc3QgRE5TIHJlc29sdXRpb24gZm9yIHRoaXMgTm9kZVxuICAvLyBwcm9jZXNzIGF2b2lkcyB0aGF0IGhhbmcuIFRoaXMgb25seSBydW5zIHNlcnZlci1zaWRlLCBzbyBpdCdzIHNhZmUgdG9cbiAgLy8gaW1wb3J0IFwiZG5zXCIgaGVyZS5cbiAgaWYgKHByb2Nlc3MuZW52Lk5FWFRfUlVOVElNRSA9PT0gXCJub2RlanNcIikge1xuICAgIGNvbnN0IGRucyA9IGF3YWl0IGltcG9ydChcImRuc1wiKTtcbiAgICBkbnMuc2V0RGVmYXVsdFJlc3VsdE9yZGVyKFwiaXB2NGZpcnN0XCIpO1xuICB9XG59XG4iXSwibmFtZXMiOlsicmVnaXN0ZXIiLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9SVU5USU1FIiwiZG5zIiwic2V0RGVmYXVsdFJlc3VsdE9yZGVyIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(instrument)/./instrumentation.ts\n");

/***/ })

},
/******/ __webpack_require__ => { // webpackRuntimeModules
/******/ var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
/******/ var __webpack_exports__ = (__webpack_exec__("(instrument)/./instrumentation.ts"));
/******/ (_ENTRIES = typeof _ENTRIES === "undefined" ? {} : _ENTRIES).middleware_instrumentation = __webpack_exports__;
/******/ }
]);