type TThenCb<T> = (value: T) => void;
type TCatchCb = (reason?: any) => void;
type TFinallyCb = () => void;
type TPromiseState = "pending" | "fulfilled" | "rejected";

class MyPromise<T = unknown> {
  private state: TPromiseState = "pending";
  private value: T | unknown;
  private thenCbs: TThenCb<T>[] = [];
  private catchCbs: TCatchCb[] = [];

  // bind will help to keep `this` context unchanged while chaining
  private onFulfillBind = this.onFulfill.bind(this);
  private onRejectBind = this.onReject.bind(this);

  constructor(
    cb: (
      onFulfill: (value: T | MyPromise<T>) => void,
      onReject: (reason?: any) => void
    ) => void
  ) {
    try {
      cb(this.onFulfillBind, this.onRejectBind);
    } catch (error) {
      this.onRejectBind(error);
    }
  }

  private runCallbacks() {
    if (this.state === "fulfilled") {
      this.thenCbs.forEach((cb) => {
        cb(this.value as T);
      });
      this.thenCbs = [];
    }
    if (this.state === "rejected") {
      this.catchCbs.forEach((cb) => {
        cb(this.value);
      });
      this.thenCbs = [];
    }
  }

  private onFulfill(value: T | MyPromise<T>) {
    // promise is async and goes into microtask queue
    queueMicrotask(() => {
      if (this.state !== "pending") return;

      if (value instanceof MyPromise) {
        value.then(this.onFulfillBind, this.onRejectBind);
        return;
      }

      this.state = "fulfilled";
      this.value = value;
      this.runCallbacks();
    });
  }

  private onReject(reason?: any) {
    // promise is async and goes into microtask queue
    queueMicrotask(() => {
      if (this.state !== "pending") return;

      // if the promise fails and no catch callback is provided,
      // promise will throw uncaught error
      if (!this.catchCbs.length) {
        throw new UncaughtError(reason as string);
      }

      if (reason instanceof MyPromise) {
        reason.then(this.onFulfillBind, this.onRejectBind);
        return;
      }

      this.state = "rejected";
      this.value = reason;
      this.runCallbacks();
    });
  }

  then(thenCb: TThenCb<T> | undefined, catchCb?: TCatchCb) {
    // returns a new instance of promise for chaining
    return new MyPromise((resolve, reject) => {
      this.thenCbs.push((result) => {
        if (!thenCb) {
          resolve(result);
          return;
        }
        try {
          resolve(thenCb(result));
        } catch (error) {
          reject(error);
        }
      });

      this.catchCbs.push((reason) => {
        if (!catchCb) {
          reject(reason);
          return;
        }
        try {
          resolve(catchCb(reason));
        } catch (error) {
          reject(error);
        }
      });

      this.runCallbacks();
    });
  }

  catch(cb: TCatchCb) {
    return this.then(undefined, cb);
  }

  finally(cb: TFinallyCb) {
    return this.then(
      (result) => {
        cb();
        return result;
      },
      (reason) => {
        cb();
        throw reason;
      }
    );
  }

  static resolve(value: unknown) {
    return new MyPromise((resolve) => {
      resolve(value);
    });
  }

  static reject(value: unknown) {
    return new MyPromise((_, reject) => {
      reject(value);
    });
  }

  /**
   * `MyPromise.all` gets resolved when all promises get fulfilled,
   * however gets rejected if any promise fails
   * @param {MyPromise[]} promises array of promises
   * @returns array of fulfilled promise results (if success) or reject reason from failed promise
   */
  static all<T = unknown>(promises: MyPromise<T>[]) {
    const results: T[] = [];
    let resolvedPromise = 0;
    return new MyPromise<T[]>((resolve, reject) => {
      promises.forEach((promise, index) => {
        promise
          .then((value) => {
            results[index] = value;
            resolvedPromise++;
            if (resolvedPromise === promises.length) {
              resolve(results);
            }
          })
          .catch(reject);
      });
    });
  }

  /**
   * `MyPromise.allSettled` gets resolved when all promises get completed,
   * either fulfilled or rejected
   * @param {MyPromise[]} promises array of promises
   * @returns array of completed promises with promise status and value (if success) or reason (if reject)
   */
  static allSettled<T = unknown>(promises: MyPromise<T>[]) {
    const results: Array<{
      status: TPromiseState;
      value?: T;
      reason?: unknown;
    }> = [];
    return new MyPromise<typeof results>((resolve) => {
      promises.forEach((promise, index) => {
        promise
          .then((value) => {
            results[index] = { status: "fulfilled", value };
          })
          .catch((reason) => {
            results[index] = { status: "rejected", reason };
          })
          .finally(() => {
            resolve(results);
          });
      });
    });
  }

  /**
   * `MyPromise.race` will get completed while any of the promise gets resolved or rejected at first
   * @param {MyPromise[]} promises array of promises
   * @returns the promise that gets completed (resolved or rejected) first
   */
  static race<T = unknown>(promises: MyPromise<T>[]) {
    return new MyPromise<T>((resolve, reject) => {
      promises.forEach((promise) => {
        promise.then(resolve).catch(reject);
      });
    });
  }

  /**
   * `MyPromise.any` gets resolve when any of the promises gets fulfilled first,
   * or gets rejected with agreegated error if all promise get rejected
   * @param {MyPromise[]} promises array of promises
   * @returns the promise that gets resolved first, if all gets fulfilled returns aggregated error
   */
  static any<T = unknown>(promises: MyPromise<T>[]) {
    let errors: unknown[] = [];
    let rejectedPromise = 0;
    return new MyPromise<T>((resolve, reject) => {
      promises.forEach((promise, index) => {
        promise
          .then((value) => {
            resolve(value);
          })
          .catch((reason) => {
            rejectedPromise++;
            errors[index] = reason;
            if (rejectedPromise === promises.length) {
              throw new AggregateError(
                errors,
                "No promise in MyPromise.any get resolved"
              );
            }
          });
      });
    });
  }
}

class UncaughtError extends Error {
  constructor(message?: string) {
    super(message);
    this.stack = `(in promise) ${this.stack}`;
  }
}

export default MyPromise;

// const promise = new MyPromise<number>((resolve, reject) => {
//   setTimeout(() => {
//     const randomNum = Math.floor(Math.random() * 10) + 1;
//     const isEven = !(randomNum % 2);
//     console.log(
//       `from promise, will ${isEven ? "resolve" : "reject"} =>`,
//       randomNum
//     );
//     if (isEven) {
//       resolve(randomNum);
//     } else {
//       reject(randomNum);
//     }
//   });
// });

// promise
//   .then((result) => {
//     const r = result * 2;
//     console.log(`then-1: multiplied by 2 =>`, r);
//     return r;
//   })
//   .then((result) => {
//     const r = (result as number) * 4;
//     console.log("then-2: multiplied by 3 =>", r);
//     return r;
//   })
//   .catch((result) => {
//     const r = (result as number) * 10;
//     console.log(`catch-1: multiplied by 10 =>`, r);
//     return r;
//   })
//   .then((result) => {
//     const r = (result as number) * 4;
//     console.log("then-2: multiplied by 4 =>", r);
//     return r;
//   });

// const p1 = new MyPromise((resolve, reject) => {
//   setTimeout(() => {
//     reject("p1");
//   }, 0);
// });
// const p2 = new MyPromise((resolve, reject) => {
//   setTimeout(() => {
//     resolve("p2");
//   }, 0);
// });
// const p3 = new MyPromise((resolve, reject) => {
//   setTimeout(() => {
//     resolve("p3");
//   }, 0);
// });

// const p1 = new Promise((resolve, reject) => {
//   reject('p1')
// });
const p1 = MyPromise.reject("p1");
const p2 = MyPromise.resolve("p2");
const p3 = MyPromise.reject("p3");

MyPromise.any([p1, p2, p3])
  .then((results) => {
    console.log("then =>", results);
  })
  .catch((reason) => {
    console.log("catch =>", reason);
  });
