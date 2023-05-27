import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
type GetApiKeyFn = (breakCache?: boolean) => Promise<string>;

enum ApiMethod {
  GET = "get",
  PATCH = "patch",
  POST = "post",
  PUT = "put",
  DELETE = "delete",
}

export class HttpClient {
  private client: AxiosInstance | undefined;

  private async refreshClient(breakCache?: boolean) {
    const key = await this.getApiKey(breakCache);
    console.log("KEY ", key);
    return axios.create({
      headers: {
        common: {
          Authorization: `Bearer ${key}`,
        },
      },
    });
  }

  constructor(private readonly getApiKey: GetApiKeyFn) {}

  public get(url: string): Promise<any> {
    console.log("FETCHING FROM ", url);
    return this.makeApiRequest(ApiMethod.GET, url);
  }

  private async makeApiRequest(
    method: ApiMethod,
    url: string,
    body?: any
  ): Promise<AxiosResponse> {
    if (!this.client) {
      console.log("REFRESHING CLIENT");
      this.client = await this.refreshClient();
    }

    const clientConfig = {
      method,
      url,
      data: body,
    };

    try {
      return await this.client(clientConfig);
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 401) {
        console.log("OH NO 401")
        this.client = await this.refreshClient(true);
        return await this.client(clientConfig);
      }
      throw error;
    }
  }
}
