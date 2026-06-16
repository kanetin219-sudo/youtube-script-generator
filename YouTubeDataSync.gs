// ============================================================
// YouTube Analytics データ Supabase 自動同期スクリプト
// YouTube Analytics API + Supabase 連携
// ============================================================

const YOUTUBE_CHANNEL_ID = 'UCr_GjBeap7-cUWGaG41mP6g';
const SUPABASE_URL = 'https://voutbjsdhsxjedddaqll.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvdXRianNkaHN4amVkZGRhcWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjQwMDksImV4cCI6MjA5NjU0MDAwOX0.NxjKLpjojfBzl-978SwqepT6v4IJwz0KP82TBerIcdo';

// ============================================================
// セットアップ関数
// ============================================================

function setupGASProperties() {
  const props = PropertiesService.getScriptProperties();

  // YouTube API キー設定
  props.setProperty('YOUTUBE_API_KEY', 'AIzaSyCAm-fD469y20mfVGMiL29_cFjPU9TmBA');

  Logger.log('✅ GAS プロパティを設定しました');
  Logger.log('  - YOUTUBE_API_KEY: 設定済み');
}

function createPerformanceSheet() {
  const ss = SpreadsheetApp.create('YouTube動画パフォーマンス');
  const sheet = ss.getActiveSheet();

  // ヘッダー行
  sheet.appendRow(['動画タイトル', 'テーマ', 'スクリプトパターン', '再生数', 'エンゲージメント率(%)', '高評価', 'コメント', '公開日']);

  // サンプルデータ
  sheet.appendRow(['YouTube成功戦略11選', 'ハウツー', 'ストーリー型導入', 15000, 8.5, 1200, 340, '2026-06-01']);
  sheet.appendRow(['初心者向けチャンネル開設ガイド', 'チュートリアル', '段階的解説', 22000, 6.2, 1800, 520, '2026-06-05']);
  sheet.appendRow(['撮影テクニック完全版', 'レビュー', 'Before/After', 8500, 4.1, 350, 120, '2026-06-10']);

  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 150);

  const sheetId = ss.getId();
  const url = ss.getUrl();

  Logger.log('✅ スプレッドシートを作成しました');
  Logger.log('  - URL: ' + url);
  Logger.log('  - ID: ' + sheetId);

  const props = PropertiesService.getScriptProperties();
  props.setProperty('PERFORMANCE_SHEET_ID', sheetId);

  return sheetId;
}

function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });

  ScriptApp.newTrigger('syncYouTubeData')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  ScriptApp.newTrigger('analyzeSuccessPatterns')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(10)
    .create();

  Logger.log('✅ トリガーを設定しました');
  Logger.log('  - syncYouTubeData: 毎日 09:00');
  Logger.log('  - analyzeSuccessPatterns: 毎週月曜日 10:00');
}

function runFullSetup() {
  Logger.log('=== GAS 全セットアップ開始 ===');
  setupGASProperties();
  const sheetId = createPerformanceSheet();
  setupTriggers();
  Logger.log('=== セットアップ完了 ===');
  Logger.log('📊 以下の URL で動画パフォーマンスデータを入力してください:');
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PERFORMANCE_SHEET_ID');
  Logger.log('https://docs.google.com/spreadsheets/d/' + id);
}

// ============================================================
// YouTube データ同期関数
// ============================================================

function fetchYouTubeVideos() {
  try {
    Logger.log('📺 YouTube 動画リスト取得開始');

    const youtubeApiKey = PropertiesService.getScriptProperties().getProperty('YOUTUBE_API_KEY');
    if (!youtubeApiKey) {
      Logger.log('⚠️ YouTube API キーが設定されていません。setupGASProperties() を実行してください。');
      return [];
    }

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

function extractSuccessPatterns() {
  try {
    Logger.log('📈 成功パターン抽出開始');

    const props = PropertiesService.getScriptProperties();
    const sheetId = props.getProperty('PERFORMANCE_SHEET_ID');

    if (!sheetId) {
      Logger.log('⚠️ パフォーマンスシートが見つかりません。createPerformanceSheet() を実行してください。');
      return [];
    }

    const ss = SpreadsheetApp.openById(sheetId);
    let sheet = ss.getSheetByName('シート1') || ss.getActiveSheet();

    const data = sheet.getDataRange().getValues();
    const highPerformingVideos = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const views = parseInt(row[3]) || 0;
      const engagement = parseFloat(row[4]) || 0;

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

    highPerformingVideos.forEach(video => {
      Logger.log(`  📺 ${video.title}: 再生数 ${video.views}, エンゲージメント ${video.engagement}%`);
    });

    return highPerformingVideos;
  } catch (e) {
    Logger.log('❌ エラー: ' + e.message);
    return [];
  }
}

function generateLearningData(successPatterns) {
  try {
    Logger.log('🧠 学習データ生成開始');

    const themes = {};
    const patterns = {};

    successPatterns.forEach(video => {
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

// ============================================================
// 定期実行関数
// ============================================================

function syncYouTubeData() {
  Logger.log('=== YouTube データ同期開始 ===');
  const videos = fetchYouTubeVideos();
  if (videos.length > 0) {
    saveVideosToSupabase(videos);
  }
  Logger.log('=== YouTube データ同期完了 ===');
}

function analyzeSuccessPatterns() {
  Logger.log('=== 成功パターン分析開始 ===');
  const successPatterns = extractSuccessPatterns();
  if (successPatterns.length > 0) {
    generateLearningData(successPatterns);
  }
  Logger.log('=== 成功パターン分析完了 ===');
}

function testSync() {
  Logger.log('=== テスト実行開始 ===');
  syncYouTubeData();
  analyzeSuccessPatterns();
  Logger.log('=== テスト実行完了 ===');
}
