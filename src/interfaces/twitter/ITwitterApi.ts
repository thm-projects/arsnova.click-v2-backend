export interface ITwitterApi {
  statuses: Array<ITwitterApiTweets>;
}

export interface ITwitterApiTweets {
  text: string;
  created_at: string;
  id: number;
  truncated: boolean;

  user: ITwitterApiUser;
  entities: ITwitterApiEntities;
}

export interface ITwitterApiUser {
  name: string;
  followers_count: number;
  profile_image_url_https: string;
  url: string;
  screen_name: string;
}

export interface ITwitterApiEntities {
  urls: ITwitterApiUrl;
}

export interface ITwitterApiUrl {
  url: string;
}
