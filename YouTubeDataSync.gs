// ============================================================
// YouTube Analytics データ Supabase 自動同期スクリプト
// YouTube Analytics API + Supabase 連携
// ============================================================

const YOUTUBE_CHANNEL_ID = 'UCr_GjBeap7-cUWGaG41mP6g';
const SUPABASE_URL = 'https://voutbjsdhsxjedddaqll.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvdXRianNkaHN4amVkZGRhcWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjQwMDksImV4cCI6MjA5NjU0MDAwOX0.NxjKLpjojfBzl-978SwqepT6v4IJwz0KP82TBerIcdo';
const SHEET_ID = '1LaUjkcp9ZSYLtTmpWGLNqhAOBpqcBoA8Z5sC_L2-Qzc';

// YouTube Data API v3 で動画リスト取得
function fetchYouTubeVideos() {
  try {
    Logger.log('📺 YouTube 動画リスト取得開始');

    // YouTube Data API を使用（API キーが必要）
    const youtubeApiKey = PropertiesService.getScriptProperties().getProperty('YOUTUBE_API_KEY');
    if (!youtubeApiKey) {
      Logger.log('⚠️ YouTube API キーが設定されていません。スクリプトプロパティに YOUTUBE_API_KEY を設定してください。');
      return [];
    }

    // チャンネルの最新動画を取得
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YOUTUBE_CHANNEL_ID}&order=date&maxResults=20&type=video&key=${youtubeApiKey}`;

    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());

    if (data.error) {
      Logger.log('❌ YouTube API エラー: ' + data.error.message);
      return [];
    }

    const videos = [];
    data.items.forEach(item => {
      videos.push({
        video_id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        published_at: item.snippet.publishedAt,
        thumbnail_url: item.snippet.thumbnails.medium.url,
        channel_id: item.snippet.channelId
      });
    });

    Logger.log(`✅ ${videos.length} 個の動画を取得しました`);
    return videos;
  } catch (e) {
    Logger.log('❌ エラー: ' + e.message);
    return [];
  }
}

// YouTube Analytics API で動画の詳細統計を取得
function fetchYouTubeAnalytics() {
  try {
    Logger.log('📊 YouTube Analytics データ取得開始');

    // YouTube Analytics API を使用（サービスアカウント認証）
    const serviceAccountKey = PropertiesService.getScriptProperties().getProperty('YOUTUBE_ANALYTICS_KEY');
    if (!serviceAccountKey) {
      Logger.log('⚠️ YouTube Analytics キーが設定されていません。');
      return {};
    }

    // パースしてトークンを取得
    let keyData;
    try {
      keyData = JSON.parse(serviceAccountKey);
    } catch (e) {
      Logger.log('⚠️ JSON パースエラー。スクリプトプロパティを確認してください。');
      return {};
    }

    // JWT トークン取得（簡略版・実装省略）
    // 実際の実装では Utilities.computeRsaSha256Signature を使用

    Logger.log('⚠️ YouTube Analytics API は複雑な認証が必要です。');
    Logger.log('    スプレッドシートで YouTube Analytics のアドオンを使うか、');
    Logger.log('    データを手動で入力してください。');

    return {};
  } catch (e) {
    Logger.log('❌ エラー: ' + e.message);
    return {};
  }
}

// 動画データを Supabase に保存
function saveVideosToSupabase(videos) {
  try {
    Logger.log('💾 Supabase に動画データを保存中');

    videos.forEach(video => {
      const payload = JSON.stringify({
        video_id: video.video_id,
        title: video.title,
        description: video.description,
        published_at: video.published_at,
        thumbnail_url: video.thumbnail_url,
        channel_id: video.channel_id
      });

      const options = {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        payload: payload,
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(
        `${SUPABASE_URL}/rest/v1/youtube_videos`,
        options
      );

      const status = response.getResponseCode();
      if (status !== 201 && status !== 200) {
        Logger.log(`⚠️ ステータス ${status}: ${video.title}`);
      }
    });

    Logger.log(`✅ ${videos.length} 個の動画を Supabase に保存しました`);
  } catch (e) {
    Logger.log('❌ エラー: ' + e.message);
  }
}

// 動画の詳細統計を Supabase に保存（手動入力用）
function saveInsightsToSupabase(videoId, insights) {
  try {
    const payload = JSON.stringify({
      video_id: videoId,
      views: insights.views || 0,
      likes: insights.likes || 0,
      comments: insights.comments || 0,
      shares: insights.shares || 0,
      watch_time_hours: insights.watch_time_hours || 0,
      average_view_duration_seconds: insights.average_view_duration_seconds || 0,
      click_through_rate: insights.click_through_rate || 0,
      subscription_conversions: insights.subscription_conversions || 0,
      measured_at: new Date().toISOString()
    });

    const options = {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      payload: payload,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(
      `${SUPABASE_URL}/rest/v1/youtube_insights`,
      options
    );

    if (response.getResponseCode() === 201) {
      Logger.log(`✅ ${videoId} のインサイトを保存しました`);
    }
  } catch (e) {
    Logger.log('❌ エラー: ' + e.message);
  }
}

// スプレッドシートから成功動画パターンを抽出して保存
function extractSuccessPatterns() {
  try {
    Logger.log('📈 成功パターン抽出開始');

    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName('動画パフォーマンス');
    if (!sheet) {
      Logger.log('⚠️ 「動画パフォーマンス」シートが見つかりません。');
      return;
    }

    const data = sheet.getDataRange().getValues();
    const highPerformingVideos = [];

    // 2行目以降を処理（1行目はヘッダー）
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const views = row[3] || 0; // 再生数列
      const engagement = row[4] || 0; // エンゲージメント率列

      // 再生数が 10,000 以上、またはエンゲージメント率が 5% 以上の動画を成功と判定
      if (views >= 10000 || engagement >= 5) {
        highPerformingVideos.push({
          title: row[0],
          theme: row[1],
          script_pattern: row[2],
          views: views,
          engagement: engagement
        });
      }
    }

    Logger.log(`✅ ${highPerformingVideos.length} 個の成功パターンを抽出しました`);

    // 成功パターンをログに出力
    highPerformingVideos.forEach(video => {
      Logger.log(`  📺 ${video.title}: 再生数 ${video.views}, エンゲージメント ${video.engagement}%`);
    });

    return highPerformingVideos;
  } catch (e) {
    Logger.log('❌ エラー: ' + e.message);
    return [];
  }
}

// 成功パターンから学習データを生成
function generateLearningData(successPatterns) {
  try {
    Logger.log('🧠 学習データ生成開始');

    const themes = {};
    const patterns = {};

    successPatterns.forEach(video => {
      // テーマごとに統計
      if (!themes[video.theme]) {
        themes[video.theme] = {
          count: 0,
          avg_views: 0,
          avg_engagement: 0
        };
      }
      themes[video.theme].count++;
      themes[video.theme].avg_views += video.views;
      themes[video.theme].avg_engagement += video.engagement;

      // スクリプトパターンごとに統計
      if (video.script_pattern) {
        if (!patterns[video.script_pattern]) {
          patterns[video.script_pattern] = {
            count: 0,
            avg_views: 0
          };
        }
        patterns[video.script_pattern].count++;
        patterns[video.script_pattern].avg_views += video.views;
      }
    });

    // 平均値計算
    Object.keys(themes).forEach(theme => {
      themes[theme].avg_views /= themes[theme].count;
      themes[theme].avg_engagement /= themes[theme].count;
    });

    Object.keys(patterns).forEach(pattern => {
      patterns[pattern].avg_views /= patterns[pattern].count;
    });

    Logger.log('✅ 学習データを生成しました');
    Logger.log('テーマ別成功率: ' + JSON.stringify(themes, null, 2));
    Logger.log('スクリプトパターン別: ' + JSON.stringify(patterns, null, 2));

    return { themes, patterns };
  } catch (e) {
    Logger.log('❌ エラー: ' + e.message);
    return { themes: {}, patterns: {} };
  }
}

// 定期実行: YouTube データを同期
function syncYouTubeData() {
  Logger.log('=== YouTube データ同期開始 ===');

  // YouTube 動画リストを取得
  const videos = fetchYouTubeVideos();

  // Supabase に保存
  if (videos.length > 0) {
    saveVideosToSupabase(videos);
  }

  Logger.log('=== YouTube データ同期完了 ===');
}

// 定期実行: 成功パターン分析
function analyzeSuccessPatterns() {
  Logger.log('=== 成功パターン分析開始 ===');

  // スプレッドシートから成功パターンを抽出
  const successPatterns = extractSuccessPatterns();

  // 学習データを生成
  if (successPatterns.length > 0) {
    generateLearningData(successPatterns);
  }

  Logger.log('=== 成功パターン分析完了 ===');
}

// API キー設定
function setupProperties() {
  const props = PropertiesService.getScriptProperties();

  // YouTube API キー（YouTube Data API v3）
  props.setProperty('YOUTUBE_API_KEY', 'ここに YouTube Data API キーを貼り付け');

  // YouTube Analytics API キー（Google Cloud JSON）
  props.setProperty('YOUTUBE_ANALYTICS_KEY', 'ここに Google Cloud サービスアカウントキーを貼り付け');

  Logger.log('✅ スクリプトプロパティを初期化しました');
  Logger.log('https://script.google.com/home/projects/ で API キーを設定してください');
}

// 定期実行トリガー設定
function setupTrigger() {
  // 既存トリガーを削除
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncYouTubeData' ||
        trigger.getHandlerFunction() === 'analyzeSuccessPatterns') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 新規トリガーを設定（毎日 09:00）
  ScriptApp.newTrigger('syncYouTubeData')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  // 成功パターン分析（毎週月曜日 10:00）
  ScriptApp.newTrigger('analyzeSuccessPatterns')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(10)
    .create();

  Logger.log('✅ トリガーを設定しました');
  Logger.log('  - syncYouTubeData: 毎日 09:00');
  Logger.log('  - analyzeSuccessPatterns: 毎週月曜日 10:00');
}

// テスト実行
function testSync() {
  Logger.log('=== テスト実行開始 ===');
  syncYouTubeData();
  analyzeSuccessPatterns();
  Logger.log('=== テスト実行完了 ===');
}
