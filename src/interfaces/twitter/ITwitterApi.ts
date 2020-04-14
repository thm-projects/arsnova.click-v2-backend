export interface ITwitterApi {
  statuses: Array<ITwitterApiTweets>;
}

export interface ITwitterApiTweets {
  text: string;
  created_at: string;
  id: number;
  id_str: string;
  truncated: boolean;
  lang: string;

  user: ITwitterApiUser;
  entities: ITwitterApiEntities;
  extended_entities?: ITwitterApiExtendedEntities;
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

export interface ITwitterApiExtendedEntities {
  media: Array<ITwitterExtendedEntityMedia>;
}

export interface ITwitterExtendedEntityMedia {
  media_url_https: string;
  type: 'photo' | string;
}

export interface ITwitterApiUrl {
  url: string;
}
