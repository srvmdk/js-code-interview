import { cityApiService } from "./cityApiService";

/**
 * Api service will have a fetch method to fetch unique data for each identifier
 */
interface IApiService {
  fetch: (identifier) => Promise<{ data: unknown; error: string }>;
}

class ApiCache<T extends IApiService> {
  private apiService: T;
  private cache: Record<string, unknown> = {};
  private timer: NodeJS.Timeout;
  private error: string;

  constructor(apiService: T) {
    this.apiService = apiService;
    // refreshes the cache on initialization
    this.setRefreshRate();
  }

  /**
   * `getData` method fetches data and stores it in cache
   * @param {String} identifier identifier for api service
   * @param {Boolean} force if true, indicates to serve fresh data invalidating cache
   * @returns data along with status if served from cache or not
   */
  async getData(
    identifier: string,
    force = !this.cache[identifier]
  ): Promise<{ data: unknown; status: "Fresh" | "Cached" }> {
    if (force) {
      const { data, error } = await this.apiService.fetch(identifier);
      this.cache[identifier] = data;
      this.error = error;
    }
    return {
      data: this.cache[identifier],
      status: force ? "Fresh" : "Cached",
    };
  }

  /**
   * `setRefreshRate` refreshes the cache at the given interval
   * @param ttl time to refresh the cache in ms, defaults to 1s
   */
  setRefreshRate(ttl = 1000) {
    // if user overrides default timer, clear out the old instance
    if (this.timer) clearInterval(this.timer);
    
    this.timer = setInterval(() => {
      // in case of api service error, no need to refetch the data
      if (this.error) clearInterval(this.timer);

      Object.keys(this.cache).forEach((identifier) => {
        this.getData(identifier, true);
      });
    }, ttl);
  }
}

// creating cache instance
const cache = new ApiCache(cityApiService);
cache.setRefreshRate(5000); // refreshes every 5s

(async () => {
  const data1 = await cache.getData("bangalore"); // fresh data
  const data2 = await cache.getData("delhi"); // fresh data
  console.log("cached data", data1, data2);
  const data3 = await cache.getData("bangalore"); // cached data
  const data4 = await cache.getData("delhi"); // cached data
})();
