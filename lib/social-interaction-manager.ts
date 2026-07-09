import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RidePost {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rideId: string;
  rideName: string;
  distance: number;
  duration: number;
  elevation: number;
  imageUrl?: string;
  caption: string;
  timestamp: number;
  likes: number;
  comments: RideComment[];
  shares: number;
  liked: boolean;
}

export interface RideComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: number;
  likes: number;
}

export interface UserProfile {
  userId: string;
  userName: string;
  avatar?: string;
  bio?: string;
  totalRides: number;
  totalDistance: number;
  followers: number;
  following: number;
  badges: string[];
  joinedDate: number;
}

export interface SocialFeed {
  posts: RidePost[];
  nextCursor?: string;
}

const POSTS_KEY = 'social_posts';
const COMMENTS_KEY = 'social_comments';
const USER_PROFILES_KEY = 'user_profiles';
const LIKES_KEY = 'social_likes';
const FOLLOWERS_KEY = 'social_followers';

export class SocialInteractionManager {
  /**
   * 分享騎乘記錄
   */
  static async shareRide(
    userId: string,
    userName: string,
    rideId: string,
    rideName: string,
    distance: number,
    duration: number,
    elevation: number,
    caption: string,
    imageUrl?: string,
    userAvatar?: string
  ): Promise<RidePost> {
    try {
      const post: RidePost = {
        id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        userName,
        userAvatar,
        rideId,
        rideName,
        distance,
        duration,
        elevation,
        imageUrl,
        caption,
        timestamp: Date.now(),
        likes: 0,
        comments: [],
        shares: 0,
        liked: false,
      };

      // 保存貼文
      const posts = await this.getAllPosts();
      posts.unshift(post);
      await AsyncStorage.setItem(POSTS_KEY, JSON.stringify(posts));

      return post;
    } catch (error) {
      console.error('Failed to share ride:', error);
      throw error;
    }
  }

  /**
   * 獲取所有貼文
   */
  static async getAllPosts(): Promise<RidePost[]> {
    try {
      const data = await AsyncStorage.getItem(POSTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get all posts:', error);
      return [];
    }
  }

  /**
   * 獲取社交動態
   */
  static async getSocialFeed(limit: number = 20): Promise<SocialFeed> {
    try {
      const posts = await this.getAllPosts();
      return {
        posts: posts.slice(0, limit),
        nextCursor: posts.length > limit ? `cursor_${limit}` : undefined,
      };
    } catch (error) {
      console.error('Failed to get social feed:', error);
      return { posts: [] };
    }
  }

  /**
   * 點讚貼文
   */
  static async likePost(postId: string, userId: string): Promise<boolean> {
    try {
      const posts = await this.getAllPosts();
      const post = posts.find((p) => p.id === postId);

      if (!post) return false;

      // 保存點讚記錄
      const likes = await this.getUserLikes(userId);
      if (!likes.includes(postId)) {
        likes.push(postId);
        await AsyncStorage.setItem(`${LIKES_KEY}_${userId}`, JSON.stringify(likes));

        post.likes += 1;
        post.liked = true;

        // 更新貼文
        await AsyncStorage.setItem(POSTS_KEY, JSON.stringify(posts));
      }

      return true;
    } catch (error) {
      console.error('Failed to like post:', error);
      return false;
    }
  }

  /**
   * 取消點讚
   */
  static async unlikePost(postId: string, userId: string): Promise<boolean> {
    try {
      const posts = await this.getAllPosts();
      const post = posts.find((p) => p.id === postId);

      if (!post) return false;

      // 移除點讚記錄
      const likes = await this.getUserLikes(userId);
      const index = likes.indexOf(postId);
      if (index > -1) {
        likes.splice(index, 1);
        await AsyncStorage.setItem(`${LIKES_KEY}_${userId}`, JSON.stringify(likes));

        post.likes = Math.max(0, post.likes - 1);
        post.liked = false;

        // 更新貼文
        await AsyncStorage.setItem(POSTS_KEY, JSON.stringify(posts));
      }

      return true;
    } catch (error) {
      console.error('Failed to unlike post:', error);
      return false;
    }
  }

  /**
   * 添加評論
   */
  static async addComment(
    postId: string,
    userId: string,
    userName: string,
    content: string,
    userAvatar?: string
  ): Promise<RideComment | null> {
    try {
      const posts = await this.getAllPosts();
      const post = posts.find((p) => p.id === postId);

      if (!post) return null;

      const comment: RideComment = {
        id: `comment_${Date.now()}`,
        userId,
        userName,
        userAvatar,
        content,
        timestamp: Date.now(),
        likes: 0,
      };

      post.comments.push(comment);

      // 更新貼文
      await AsyncStorage.setItem(POSTS_KEY, JSON.stringify(posts));

      return comment;
    } catch (error) {
      console.error('Failed to add comment:', error);
      return null;
    }
  }

  /**
   * 獲取貼文評論
   */
  static async getPostComments(postId: string): Promise<RideComment[]> {
    try {
      const posts = await this.getAllPosts();
      const post = posts.find((p) => p.id === postId);

      return post?.comments || [];
    } catch (error) {
      console.error('Failed to get post comments:', error);
      return [];
    }
  }

  /**
   * 獲取用戶點讚
   */
  private static async getUserLikes(userId: string): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(`${LIKES_KEY}_${userId}`);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get user likes:', error);
      return [];
    }
  }

  /**
   * 獲取用戶資料
   */
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const data = await AsyncStorage.getItem(`${USER_PROFILES_KEY}_${userId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }

  /**
   * 更新用戶資料
   */
  static async updateUserProfile(profile: UserProfile): Promise<void> {
    try {
      await AsyncStorage.setItem(`${USER_PROFILES_KEY}_${profile.userId}`, JSON.stringify(profile));
    } catch (error) {
      console.error('Failed to update user profile:', error);
    }
  }

  /**
   * 關注用戶
   */
  static async followUser(followerId: string, followingId: string): Promise<boolean> {
    try {
      // 獲取關注列表
      const followers = await this.getFollowing(followerId);

      if (!followers.includes(followingId)) {
        followers.push(followingId);
        await AsyncStorage.setItem(`${FOLLOWERS_KEY}_${followerId}`, JSON.stringify(followers));

        // 更新被關注用戶的粉絲數
        const profile = await this.getUserProfile(followingId);
        if (profile) {
          profile.followers += 1;
          await this.updateUserProfile(profile);
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to follow user:', error);
      return false;
    }
  }

  /**
   * 取消關注
   */
  static async unfollowUser(followerId: string, followingId: string): Promise<boolean> {
    try {
      const followers = await this.getFollowing(followerId);
      const index = followers.indexOf(followingId);

      if (index > -1) {
        followers.splice(index, 1);
        await AsyncStorage.setItem(`${FOLLOWERS_KEY}_${followerId}`, JSON.stringify(followers));

        // 更新被關注用戶的粉絲數
        const profile = await this.getUserProfile(followingId);
        if (profile) {
          profile.followers = Math.max(0, profile.followers - 1);
          await this.updateUserProfile(profile);
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to unfollow user:', error);
      return false;
    }
  }

  /**
   * 獲取關注列表
   */
  static async getFollowing(userId: string): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(`${FOLLOWERS_KEY}_${userId}`);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get following list:', error);
      return [];
    }
  }

  /**
   * 獲取用戶貼文
   */
  static async getUserPosts(userId: string): Promise<RidePost[]> {
    try {
      const posts = await this.getAllPosts();
      return posts.filter((p) => p.userId === userId);
    } catch (error) {
      console.error('Failed to get user posts:', error);
      return [];
    }
  }

  /**
   * 分享到社交媒體
   */
  static async shareToSocialMedia(
    platform: 'facebook' | 'instagram' | 'twitter',
    post: RidePost
  ): Promise<boolean> {
    try {
      const shareText = `我剛完成了一次精彩的騎乘！🚴 ${post.rideName} - ${post.distance.toFixed(1)}km, 爬升 ${post.elevation}m。#騎乘 #自行車`;

      // 模擬分享到社交媒體
      console.log(`Sharing to ${platform}: ${shareText}`);

      // 實際應用中應該調用相應平台的 API
      // 例如：Facebook Share Dialog、Instagram API、Twitter API

      return true;
    } catch (error) {
      console.error('Failed to share to social media:', error);
      return false;
    }
  }

  /**
   * 獲取熱門貼文
   */
  static async getTrendingPosts(limit: number = 10): Promise<RidePost[]> {
    try {
      const posts = await this.getAllPosts();

      // 按點讚數排序
      return posts.sort((a, b) => b.likes - a.likes).slice(0, limit);
    } catch (error) {
      console.error('Failed to get trending posts:', error);
      return [];
    }
  }

  /**
   * 獲取推薦用戶
   */
  static async getRecommendedUsers(userId: string, limit: number = 5): Promise<UserProfile[]> {
    try {
      const following = await this.getFollowing(userId);
      const allUsers: UserProfile[] = [];

      // 收集所有用戶（實際應用中應從後端獲取）
      // 這裡使用模擬數據
      const mockUsers: UserProfile[] = [
        {
          userId: 'user_1',
          userName: '騎乘達人',
          totalRides: 150,
          totalDistance: 5000,
          followers: 500,
          following: 100,
          badges: ['🏆', '⭐'],
          joinedDate: Date.now() - 365 * 24 * 60 * 60 * 1000,
        },
        {
          userId: 'user_2',
          userName: '速度獵人',
          totalRides: 120,
          totalDistance: 4500,
          followers: 350,
          following: 80,
          badges: ['⚡'],
          joinedDate: Date.now() - 180 * 24 * 60 * 60 * 1000,
        },
      ];

      // 過濾已關注的用戶
      return mockUsers.filter((u) => !following.includes(u.userId)).slice(0, limit);
    } catch (error) {
      console.error('Failed to get recommended users:', error);
      return [];
    }
  }
}
