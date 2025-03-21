// src/polyfills.js
if (typeof Promise.withResolvers !== "function") {
    Promise.withResolvers = function () {
      let resolve, reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      promise.resolve = resolve;
      promise.reject = reject;
      return promise;
    };
  }