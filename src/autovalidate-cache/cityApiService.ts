class CityApiService {
  private api = "https://api.api-ninjas.com/v1/city";

  private data;
  private error;

  async fetch(city: string) {
    try {
      const response = await fetch(`${this.api}/?name=${city}`, {
        headers: {
          // add your api key in .env file
          "X-Api-Key": process.env.NINJAS_API_KEY as string,
        },
      });
      const data = await response.json();
      if (data?.error) {
        throw new Error(data.error)
      }
      this.data = data;
    } catch (error) {
      if (error instanceof Error) {
        this.error = error.message;
      }
    }

    return { data: this.data, error: this.error };
  }
}

export const cityApiService = new CityApiService();

