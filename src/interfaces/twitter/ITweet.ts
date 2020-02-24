// Essential data of a Tweet
export interface ITweet {
    created_at: string;
    id: number;
    name: string;
    text: string;
    truncated: boolean;
    url: string;
    followers_count: number;
    profile_image_url_https: string;
    user_url: string;
    screen_name: string;
}
