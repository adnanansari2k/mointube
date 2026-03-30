<template>
  <div id="app">

    <!-- ── Splash ── -->
    <div v-if="appState === 'init'" class="splash">
      <div class="splash-logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="9"/>
          <path d="M10 8.5l5 3.5-5 3.5V8.5z" fill="currentColor" stroke="none"/>
        </svg>
      </div>
      <p class="splash-name">Moin<em>Tube</em></p>
      <div class="splash-loader"></div>
    </div>

    <div v-else-if="appState === 'error'" class="splash">
      <div class="state-icon">🔥</div>
      <h2 style="font-family:var(--font-display);font-size:1.2rem;margin-top:8px">Firebase Error</h2>
      <p style="font-size:.82rem;color:var(--text-muted);margin-top:8px;max-width:300px;text-align:center">{{ initError }}</p>
      <p style="font-size:.76rem;color:var(--text-faint);margin-top:6px">Check your firebase.js config and reload.</p>
    </div>

    <template v-else>
      <!-- ── Header ── -->
      <header class="site-header">
        <div class="header-inner">
          <div class="logo">
            <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="9"/>
              <path d="M10 8.5l5 3.5-5 3.5V8.5z" fill="currentColor" stroke="none"/>
            </svg>
            <span class="logo-text">Moin<em>Tube</em></span>
          </div>
          <div class="header-right">
            <span v-if="syncing" class="sync-pill"><span class="sync-dot"></span>Syncing…</span>
            <span v-else-if="activeTab === 'feed' && lastFetchTime" class="cache-pill">{{ lastFetchRelative }}</span>
          </div>
        </div>
      </header>

      <!-- ── Channel Strip (Feed only) ── -->
      <div v-if="activeTab === 'feed' && channels.length > 0" class="channel-strip-wrap">
        <div class="channel-strip">
          <!-- All -->
          <button class="channel-chip" :class="{ active: selectedChannel === null }" @click="selectChannel(null)">All</button>
          <!-- First 10 channels -->
          <button
            v-for="ch in stripChannels" :key="ch.id"
            class="channel-chip"
            :class="{ active: selectedChannel === ch.id }"
            @click="selectChannel(ch.id)"
          >{{ ch.name || ch.id }}</button>
          <!-- More button -->
          <button v-if="channels.length > STRIP_LIMIT" class="channel-chip channel-chip--more" @click="channelSheetOpen = true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
            {{ channels.length - STRIP_LIMIT }} more
          </button>
        </div>
      </div>

      <!-- ── Main ── -->
      <main class="app-main">

        <!-- FEED -->
        <div v-show="activeTab === 'feed'">
          <div v-if="!apiKey" class="state-screen">
            <div class="state-icon">🔑</div>
            <h2>Set your YouTube API key</h2>
            <p>Go to Settings → API Key and paste your key.</p>
            <button class="btn-primary" @click="activeTab = 'settings'">Open Settings</button>
          </div>
          <div v-else-if="channels.length === 0" class="state-screen">
            <div class="state-icon">📺</div>
            <h2>Add your first channel</h2>
            <p>Go to Settings and paste a YouTube Channel ID.</p>
            <button class="btn-primary" @click="activeTab = 'settings'">Go to Settings</button>
          </div>
          <div v-else-if="loading" class="state-screen">
            <div class="loader"></div>
            <p class="loading-text">{{ loadingMsg }}</p>
          </div>
          <div v-else-if="error" class="state-screen">
            <div class="state-icon">⚠️</div>
            <h2>Something went wrong</h2>
            <p class="error-msg">{{ error }}</p>
            <button class="btn-primary" @click="fetchAll(true)">Try again</button>
          </div>
          <template v-else>
            <div class="feed-meta" v-if="filteredVideos.length">
              <span class="feed-count">{{ filteredVideos.length }} videos</span>
              <span class="feed-unwatched" v-if="unwatchedCount > 0"> · {{ unwatchedCount }} unwatched</span>
              <span v-if="selectedChannel === null && hiddenChannelCount > 0" class="feed-hidden-note"> · {{ hiddenChannelCount }} hidden</span>
              <span v-if="newVideosCount > 0" class="feed-new-badge">+{{ newVideosCount }} new</span>
            </div>
            <div class="video-grid" v-if="pagedVideos.length">
              <VideoCard
                v-for="video in pagedVideos"
                :key="getVid(video)"
                :video="video"
                :progress="getProgress(getVid(video))"
                :is-watch-later="!!watchLater[getVid(video)]"
                :is-bookmarked="!!bookmarks[getVid(video)]"
                @play="openPlayer"
                @toggle-watch-later="toggleWatchLater"
                @toggle-bookmark="toggleBookmark"
              />
            </div>
            <div v-else class="state-screen">
              <div class="state-icon">✨</div>
              <h2>All caught up</h2>
              <p>No videos for this filter.</p>
            </div>
            <div v-if="hasMorePages" class="load-more-row">
              <button class="btn-load-more" @click="currentPage++">
                Load more <span class="load-more-count">{{ filteredVideos.length - currentPage * PAGE_SIZE }} left</span>
              </button>
            </div>
            <div v-else-if="pagedVideos.length > 0 && filteredVideos.length > PAGE_SIZE" class="all-loaded-note">
              All {{ filteredVideos.length }} videos loaded
            </div>
          </template>
        </div>

        <!-- HISTORY -->
        <div v-show="activeTab === 'history'">
          <div v-if="historyList.length === 0" class="state-screen">
            <div class="state-icon">🕰️</div>
            <h2>No watch history yet</h2>
            <p>Videos you watch appear here, newest first.</p>
          </div>
          <template v-else>
            <div class="feed-meta"><span class="feed-count">{{ historyList.length }} watched</span></div>
            <div class="video-grid">
              <VideoCard
                v-for="entry in pagedHistory" :key="entry.videoId"
                :video="entry.video"
                :progress="getProgress(entry.videoId)"
                :is-watch-later="!!watchLater[entry.videoId]"
                :is-bookmarked="!!bookmarks[entry.videoId]"
                @play="openPlayer"
                @toggle-watch-later="toggleWatchLater"
                @toggle-bookmark="toggleBookmark"
              />
            </div>
            <div v-if="hasMoreHistory" class="load-more-row">
              <button class="btn-load-more" @click="historyPage++">
                Load more <span class="load-more-count">{{ historyList.length - historyPage * PAGE_SIZE }} left</span>
              </button>
            </div>
          </template>
        </div>

        <!-- SAVED -->
        <div v-show="activeTab === 'saved'">
          <!-- Sub-tabs -->
          <div class="sub-tabs">
            <button class="sub-tab" :class="{ active: savedSubTab === 'watchlater' }" @click="savedSubTab = 'watchlater'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>
              Watch Later <span class="sub-tab-count">{{ watchLaterList.length }}</span>
            </button>
            <button class="sub-tab" :class="{ active: savedSubTab === 'bookmarks' }" @click="savedSubTab = 'bookmarks'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              Bookmarks <span class="sub-tab-count">{{ bookmarkList.length }}</span>
            </button>
          </div>

          <!-- Watch Later -->
          <template v-if="savedSubTab === 'watchlater'">
            <div v-if="watchLaterList.length === 0" class="state-screen">
              <div class="state-icon">🕐</div>
              <h2>Watch Later is empty</h2>
              <p>Hover a video card and tap the clock icon to save it.</p>
            </div>
            <div v-else class="video-grid">
              <VideoCard
                v-for="entry in watchLaterList" :key="entry.videoId"
                :video="entry.video"
                :progress="getProgress(entry.videoId)"
                :is-watch-later="true"
                :is-bookmarked="!!bookmarks[entry.videoId]"
                @play="openPlayer"
                @toggle-watch-later="toggleWatchLater"
                @toggle-bookmark="toggleBookmark"
              />
            </div>
          </template>

          <!-- Bookmarks -->
          <template v-if="savedSubTab === 'bookmarks'">
            <div v-if="bookmarkList.length === 0" class="state-screen">
              <div class="state-icon">🔖</div>
              <h2>No bookmarks yet</h2>
              <p>Hover a video card and tap the bookmark icon to save it.</p>
            </div>
            <div v-else class="video-grid">
              <VideoCard
                v-for="entry in bookmarkList" :key="entry.videoId"
                :video="entry.video"
                :progress="getProgress(entry.videoId)"
                :is-watch-later="!!watchLater[entry.videoId]"
                :is-bookmarked="true"
                @play="openPlayer"
                @toggle-watch-later="toggleWatchLater"
                @toggle-bookmark="toggleBookmark"
              />
            </div>
          </template>
        </div>

        <!-- SETTINGS -->
        <div v-show="activeTab === 'settings'" class="settings-inner">

          <div class="firebase-status-bar">
            <span class="fb-dot" :class="uid ? 'fb-dot--ok' : 'fb-dot--err'"></span>
            <span class="fb-label">{{ uid ? 'Firebase · ' + uid.slice(0,8) + '…' : 'Not connected' }}</span>
          </div>

          <!-- Channels -->
          <section class="settings-section">
            <h2 class="settings-title">Channels <span class="title-count" v-if="channels.length">{{ channels.length }}</span></h2>
            <div class="add-channel-row">
              <input v-model="channelInput" class="text-input" placeholder="Paste a YouTube Channel ID…" @keydown.enter="addChannel" :disabled="addingChannel"/>
              <button class="btn-primary" @click="addChannel" :disabled="!channelInput.trim() || addingChannel">{{ addingChannel ? '…' : 'Add' }}</button>
            </div>
            <p class="hint-text">Find it at youtube.com/channel/<strong>UCxxxxxx</strong></p>

            <template v-if="channels.length">
              <div class="quota-info">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:13px;height:13px;flex-shrink:0"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Incremental refresh: only new videos fetched. ~{{ channels.length }} units/refresh (free limit: 10,000/day).
              </div>
              <ul class="channel-list">
                <li v-for="ch in visibleChannels" :key="ch.id" class="channel-item" :class="{ 'channel-item--hidden': ch.hiddenFromAll }">
                  <button class="btn-eye" :class="{ 'btn-eye--off': ch.hiddenFromAll }" @click="toggleHideFromAll(ch.id)" :title="ch.hiddenFromAll ? 'Hidden from All' : 'Visible in All'">
                    <svg v-if="!ch.hiddenFromAll" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  </button>
                  <div class="channel-info">
                    <span class="channel-name">{{ ch.name || ch.id }}</span>
                    <span class="channel-id-badge">{{ ch.id.slice(0,14) }}…</span>
                  </div>
                  <span v-if="ch.hiddenFromAll" class="hidden-tag">Hidden</span>
                  <button class="btn-remove" @click="removeChannel(ch.id)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </li>
              </ul>
              <button v-if="channels.length > CHANNELS_PREVIEW" class="btn-expand-channels" @click="channelListExpanded = !channelListExpanded">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;transition:transform .2s" :style="{ transform: channelListExpanded ? 'rotate(180deg)' : 'none' }"><polyline points="6 9 12 15 18 9"/></svg>
                {{ channelListExpanded ? 'Show less' : `Show all ${channels.length} channels` }}
              </button>
            </template>
            <p v-else class="empty-note">No channels yet.</p>
          </section>

          <!-- API Key -->
          <section class="settings-section">
            <h2 class="settings-title">YouTube API Key</h2>
            <div class="add-channel-row">
              <input v-model="apiKeyInput" class="text-input" :type="showKey ? 'text' : 'password'" placeholder="AIza…"/>
              <button class="btn-ghost" @click="showKey = !showKey">{{ showKey ? 'Hide' : 'Show' }}</button>
              <button class="btn-primary" @click="saveApiKey">Save</button>
            </div>
            <p class="hint-text">Saved to Firebase. Only sent to YouTube's API.</p>
          </section>

          <!-- Feed & Quota -->
          <section class="settings-section">
            <h2 class="settings-title">Feed &amp; Quota</h2>
            <div class="quota-detail">
              <div class="quota-row">
                <span>Videos fetched per channel</span>
                <div class="stepper">
                  <button class="stepper-btn" @click="adjustVPC(-5)" :disabled="videosPerChannel <= 5">−</button>
                  <span class="stepper-val">{{ videosPerChannel }}</span>
                  <button class="stepper-btn" @click="adjustVPC(5)"  :disabled="videosPerChannel >= 50">+</button>
                </div>
              </div>
              <div class="quota-row">
                <span>Cards per page</span>
                <div class="stepper">
                  <button class="stepper-btn" @click="adjustPS(-4)" :disabled="PAGE_SIZE <= 8">−</button>
                  <span class="stepper-val">{{ PAGE_SIZE }}</span>
                  <button class="stepper-btn" @click="adjustPS(4)"  :disabled="PAGE_SIZE >= 48">+</button>
                </div>
              </div>
              <p class="hint-text" style="margin-top:2px">Incremental refresh only fetches truly new videos — zero quota waste.</p>
            </div>
            <div class="cache-row" style="margin-top:8px">
              <span class="cache-info">Auto-refresh every 3h. {{ lastFetchTime ? 'Last: ' + lastFetchRelative : 'Not fetched.' }}</span>
              <button class="btn-ghost" @click="fetchAll(true)" :disabled="loading">Refresh now</button>
            </div>
          </section>

          <!-- Analytics -->
          <section class="settings-section">
            <h2 class="settings-title">Analytics</h2>
            <div class="analytics-grid">
              <div class="stat-card">
                <div class="stat-value">{{ analytics.videosWatched }}</div>
                <div class="stat-label">Watched</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ fmtDur(analytics.videoWatchSec) }}</div>
                <div class="stat-label">Watch Time</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ fmtDur(analytics.siteBrowseSec) }}</div>
                <div class="stat-label">Browse Time</div>
              </div>
              <div class="stat-card accent-card">
                <div class="stat-value">{{ fmtDur(analytics.videoWatchSec + analytics.siteBrowseSec) }}</div>
                <div class="stat-label">Total Time</div>
              </div>
            </div>
            <div class="analytics-bar-wrap" v-if="analytics.videoWatchSec + analytics.siteBrowseSec > 0">
              <div class="bar-label"><span>Watching</span><span>Browsing</span></div>
              <div class="analytics-bar"><div class="bar-fill" :style="{ width: watchRatio + '%' }"></div></div>
              <div class="bar-sub"><span>{{ fmtDur(analytics.videoWatchSec) }}</span><span>{{ fmtDur(analytics.siteBrowseSec) }}</span></div>
            </div>
            <div class="clear-row">
              <button class="btn-ghost btn-danger" @click="clearHistory">Clear History</button>
              <button class="btn-ghost btn-danger" @click="clearAnalytics">Reset Analytics</button>
            </div>
          </section>

        </div>
      </main>

      <!-- ── Bottom Nav (4 items) ── -->
      <nav class="bottom-nav">
        <button class="nav-item" :class="{ active: activeTab === 'feed' }" @click="activeTab = 'feed'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span>Feed</span>
        </button>
        <button class="nav-item" :class="{ active: activeTab === 'saved' }" @click="activeTab = 'saved'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          <span>Saved</span>
          <span v-if="savedTotal > 0" class="nav-badge">{{ savedTotal }}</span>
        </button>
        <button class="nav-item" :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>
          </svg>
          <span>History</span>
          <span v-if="historyList.length" class="nav-badge">{{ historyList.length }}</span>
        </button>
        <button class="nav-item" :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>Settings</span>
        </button>
      </nav>

      <!-- ── Channel Picker Sheet ── -->
      <transition name="sheet">
        <div v-if="channelSheetOpen" class="sheet-backdrop" @click.self="channelSheetOpen = false">
          <div class="sheet">
            <div class="sheet-header">
              <h3 class="sheet-title">All Channels</h3>
              <div class="sheet-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;color:var(--text-faint)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input v-model="channelSearch" class="sheet-search-input" placeholder="Search channels…" />
              </div>
              <button class="sheet-close" @click="channelSheetOpen = false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="sheet-body">
              <!-- "All" option -->
              <button class="sheet-channel-btn" :class="{ active: selectedChannel === null }" @click="selectChannel(null); channelSheetOpen = false">
                <span class="sheet-ch-dot" style="background:var(--accent)"></span>
                <span class="sheet-ch-name">All Channels</span>
                <svg v-if="selectedChannel === null" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--accent)"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button
                v-for="ch in filteredSheetChannels" :key="ch.id"
                class="sheet-channel-btn"
                :class="{ active: selectedChannel === ch.id, dimmed: ch.hiddenFromAll }"
                @click="selectChannel(ch.id); channelSheetOpen = false"
              >
                <span class="sheet-ch-dot" :style="{ background: ch.hiddenFromAll ? 'var(--border)' : 'var(--accent)' }"></span>
                <div class="sheet-ch-info">
                  <span class="sheet-ch-name">{{ ch.name || ch.id }}</span>
                  <span v-if="ch.hiddenFromAll" class="sheet-ch-hidden">hidden from All</span>
                </div>
                <svg v-if="selectedChannel === ch.id" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--accent)"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <p v-if="filteredSheetChannels.length === 0" class="sheet-empty">No channels match "{{ channelSearch }}"</p>
            </div>
          </div>
        </div>
      </transition>

      <!-- ── Player Modal ── -->
      <transition name="fade">
        <div v-if="activeVideo" class="modal-backdrop" @click.self="closePlayer">
          <div class="modal">
            <div class="modal-header">
              <div class="modal-meta">
                <p class="modal-channel">{{ activeVideo.snippet.channelTitle }}</p>
                <h2 class="modal-title">{{ activeVideo.snippet.title }}</h2>
              </div>
              <button class="btn-icon" @click="closePlayer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="modal-progress-track">
              <div class="modal-progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
            <div class="iframe-wrap"><div id="yt-player-container"></div></div>
            <div class="modal-progress-label" v-if="liveProgress.totalSec > 0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:13px;height:13px;color:var(--accent)"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
              {{ fmtDur(liveProgress.watchedSec) }} watched · {{ fmtDur(liveProgress.totalSec) }} total
              <span v-if="liveProgress.lastPosition > 5" style="margin-left:6px;color:var(--text-faint)">· resumed from {{ fmtDur(liveProgress.lastPosition) }}</span>
            </div>
            <div class="modal-desc" v-if="activeVideo.snippet.description">
              <p>{{ activeVideo.snippet.description.slice(0, 500) }}{{ activeVideo.snippet.description.length > 500 ? '…' : '' }}</p>
            </div>
          </div>
        </div>
      </transition>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import VideoCard from './VideoCard.vue'
import {
  ensureAuth,
  fbGetChannels, fbAddChannel, fbRemoveChannel, fbUpdateChannelName, fbUpdateChannelNewest,
  fbGetVideoCache, fbSetVideoCache,
  fbGetConfig, fbSetConfig,
  fbGetProgress, fbSetProgress,
  fbGetHistory, fbSetHistory,
  fbGetAnalytics, fbSetAnalytics,
  fbGetSaved, fbSetSaved
} from './firebase.js'

// ─── Constants ───────────────────────────────────────────────────
const CACHE_TTL        = 3 * 60 * 60 * 1000
const YT_BASE          = 'https://www.googleapis.com/youtube/v3'
const SHORT_RX         = /#shorts?\b/i
const STRIP_LIMIT      = 10   // chips visible before "more" btn
const CHANNELS_PREVIEW = 4    // rows in settings before expand

// ─── App state ───────────────────────────────────────────────────
const appState  = ref('init')
const initError = ref('')
const uid       = ref(null)
const syncing   = ref(false)

// ─── UI ──────────────────────────────────────────────────────────
const activeTab           = ref('feed')
const savedSubTab         = ref('watchlater')
const selectedChannel     = ref(null)
const channelInput        = ref('')
const apiKeyInput         = ref('')
const showKey             = ref(false)
const addingChannel       = ref(false)
const channelListExpanded = ref(false)
const channelSheetOpen    = ref(false)
const channelSearch       = ref('')

// ─── Pagination ──────────────────────────────────────────────────
const pageSizeRef = ref(12)
const PAGE_SIZE   = computed(() => pageSizeRef.value)
const currentPage = ref(1)
const historyPage = ref(1)

// ─── Settings ────────────────────────────────────────────────────
const videosPerChannel = ref(10)

// ─── Data ────────────────────────────────────────────────────────
const channels      = ref([])
const apiKey        = ref('')
const videos        = ref([])
const loading       = ref(false)
const loadingMsg    = ref('Loading…')
const error         = ref(null)
const lastFetchTime = ref(null)
const newVideosCount = ref(0)   // how many new videos fetched in last incremental refresh

// ─── Watch state ─────────────────────────────────────────────────
const progressMap = ref({})
const historyMap  = ref({})
const analytics   = ref({ videosWatched: 0, videoWatchSec: 0, siteBrowseSec: 0 })

// ─── Saved ───────────────────────────────────────────────────────
const watchLater = ref({})   // { [videoId]: { video, savedAt } }
const bookmarks  = ref({})
let   fbSavedDebounce = null

// ─── Player ──────────────────────────────────────────────────────
const activeVideo  = ref(null)
const liveProgress = ref({ watchedSec: 0, totalSec: 0, lastPosition: 0 })
let ytPlayer       = null
let pollTimer      = null
let sessionStart   = null
let browseTimer    = null
let fbProgressDebounce  = null
let fbAnalyticsDebounce = null

// ─── Helpers ─────────────────────────────────────────────────────
function getVid(video) {
  const id = video.id
  return typeof id === 'object' ? id.videoId : id
}

function fmtDur(s) {
  if (!s || s < 1) return '0s'
  s = Math.floor(s)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m${sec > 0 ? ' ' + sec + 's' : ''}`
  return `${sec}s`
}

const lastFetchRelative = computed(() => {
  if (!lastFetchTime.value) return ''
  const d = Date.now() - lastFetchTime.value
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
})

// ─── Channel strip ───────────────────────────────────────────────
const stripChannels = computed(() => channels.value.slice(0, STRIP_LIMIT))

const filteredSheetChannels = computed(() => {
  if (!channelSearch.value.trim()) return channels.value
  const q = channelSearch.value.toLowerCase()
  return channels.value.filter(c => (c.name || c.id).toLowerCase().includes(q))
})

const visibleChannels = computed(() =>
  channelListExpanded.value ? channels.value : channels.value.slice(0, CHANNELS_PREVIEW)
)

const hiddenChannelCount = computed(() => channels.value.filter(c => c.hiddenFromAll).length)

function selectChannel(id) {
  selectedChannel.value = id
  currentPage.value = 1
}

// ─── Filtered videos ─────────────────────────────────────────────
const filteredVideos = computed(() => {
  let list
  if (selectedChannel.value) {
    list = videos.value.filter(v => v.snippet.channelId === selectedChannel.value)
  } else {
    const hidden = new Set(channels.value.filter(c => c.hiddenFromAll).map(c => c.id))
    list = videos.value.filter(v => !hidden.has(v.snippet.channelId))
  }
  const unwatched = list.filter(v => !progressMap.value[getVid(v)]?.watchedSec)
  const watched   = list.filter(v =>  progressMap.value[getVid(v)]?.watchedSec > 0)
  return [...unwatched, ...watched]
})

const pagedVideos   = computed(() => filteredVideos.value.slice(0, currentPage.value * PAGE_SIZE.value))
const hasMorePages  = computed(() => pagedVideos.value.length < filteredVideos.value.length)
const unwatchedCount = computed(() => filteredVideos.value.filter(v => !progressMap.value[getVid(v)]?.watchedSec).length)

watch([selectedChannel, () => PAGE_SIZE.value], () => { currentPage.value = 1 })

// ─── History ─────────────────────────────────────────────────────
const historyList  = computed(() => Object.values(historyMap.value).sort((a, b) => b.watchedAt - a.watchedAt))
const pagedHistory = computed(() => historyList.value.slice(0, historyPage.value * PAGE_SIZE.value))
const hasMoreHistory = computed(() => pagedHistory.value.length < historyList.value.length)

// ─── Saved lists ─────────────────────────────────────────────────
const watchLaterList = computed(() => Object.values(watchLater.value).sort((a, b) => b.savedAt - a.savedAt))
const bookmarkList   = computed(() => Object.values(bookmarks.value).sort((a, b) => b.savedAt - a.savedAt))
const savedTotal     = computed(() => watchLaterList.value.length + bookmarkList.value.length)

function getProgress(id) { return progressMap.value[id] || null }

const progressPercent = computed(() => {
  if (!liveProgress.value.totalSec) return 0
  return Math.min(100, (liveProgress.value.watchedSec / liveProgress.value.totalSec) * 100)
})

const watchRatio = computed(() => {
  const t = analytics.value.videoWatchSec + analytics.value.siteBrowseSec
  return t ? Math.round((analytics.value.videoWatchSec / t) * 100) : 0
})

// ─── Saved actions ───────────────────────────────────────────────
function persistSaved() {
  clearTimeout(fbSavedDebounce)
  fbSavedDebounce = setTimeout(() => {
    fbSetSaved(uid.value, { watchLater: watchLater.value, bookmarks: bookmarks.value }).catch(console.warn)
  }, 2000)
}

function toggleWatchLater(video) {
  const id = getVid(video)
  if (watchLater.value[id]) { delete watchLater.value[id] }
  else { watchLater.value[id] = { videoId: id, video, savedAt: Date.now() } }
  watchLater.value = { ...watchLater.value }
  persistSaved()
}

function toggleBookmark(video) {
  const id = getVid(video)
  if (bookmarks.value[id]) { delete bookmarks.value[id] }
  else { bookmarks.value[id] = { videoId: id, video, savedAt: Date.now() } }
  bookmarks.value = { ...bookmarks.value }
  persistSaved()
}

// ─── Settings steppers ───────────────────────────────────────────
function adjustPS(d)  { pageSizeRef.value = Math.max(8, Math.min(48, pageSizeRef.value + d)); fbSetConfig(uid.value, { pageSize: pageSizeRef.value }).catch(console.warn) }
function adjustVPC(d) { videosPerChannel.value = Math.max(5, Math.min(50, videosPerChannel.value + d)); fbSetConfig(uid.value, { videosPerChannel: videosPerChannel.value }).catch(console.warn) }

// ─── Shorts ──────────────────────────────────────────────────────
function isShort(v) { return SHORT_RX.test(v.snippet.title + ' ' + v.snippet.description) }

// ─── Hide from All ───────────────────────────────────────────────
async function toggleHideFromAll(channelId) {
  const ch = channels.value.find(c => c.id === channelId)
  if (!ch) return
  ch.hiddenFromAll = !ch.hiddenFromAll
  syncing.value = true
  await fbUpdateChannelName(uid.value, channelId, ch.name, ch.uploadsPlaylistId, ch.hiddenFromAll)
  syncing.value = false
}

// ─── Debounced Firebase ──────────────────────────────────────────
function dFbProgress() {
  clearTimeout(fbProgressDebounce)
  fbProgressDebounce = setTimeout(() => {
    fbSetProgress(uid.value, progressMap.value).catch(console.warn)
    fbSetHistory(uid.value, historyMap.value).catch(console.warn)
  }, 4000)
}
function dFbAnalytics() {
  clearTimeout(fbAnalyticsDebounce)
  fbAnalyticsDebounce = setTimeout(() => fbSetAnalytics(uid.value, analytics.value).catch(console.warn), 5000)
}

// ─── YouTube API ─────────────────────────────────────────────────
async function fetchPlaylistPage(uploadsPlaylistId, maxResults) {
  const url = new URL(`${YT_BASE}/playlistItems`)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('playlistId', uploadsPlaylistId)
  url.searchParams.set('maxResults', String(Math.min(50, maxResults)))
  url.searchParams.set('key', apiKey.value)
  const res = await fetch(url)
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e?.error?.message || 'API error') }
  return (await res.json()).items || []
}

async function resolveChannel(channelId) {
  const res = await fetch(`${YT_BASE}/channels?part=contentDetails,snippet&id=${channelId}&key=${apiKey.value}`)
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e?.error?.message || 'Channel lookup failed') }
  const data = await res.json()
  const item = data.items?.[0]
  if (!item) throw new Error(`Channel not found: ${channelId}`)
  return { name: item.snippet.title, uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads }
}

function mapItem(item, channelId) {
  return { ...item, id: item.snippet.resourceId.videoId, snippet: { ...item.snippet, channelId } }
}

// ─── INCREMENTAL REFRESH ─────────────────────────────────────────
// For each channel, only fetch up to videosPerChannel.value items.
// Filter out anything we already have (by videoId). If force=true, fetch full set.
async function fetchAll(force = false) {
  if (!apiKey.value || !channels.value.length) return
  loading.value = true; loadingMsg.value = 'Checking for new videos…'; error.value = null; newVideosCount.value = 0
  try {
    const existingIds = new Set(videos.value.map(v => getVid(v)))
    let addedCount = 0
    const allNew = []

    for (const ch of channels.value) {
      loadingMsg.value = `Checking ${ch.name || ch.id}…`

      // Get the date of the newest video we already have for this channel
      const chVideos = videos.value.filter(v => v.snippet.channelId === ch.id)
      const newestDate = chVideos.length
        ? Math.max(...chVideos.map(v => new Date(v.snippet.publishedAt).getTime()))
        : 0

      const items = await fetchPlaylistPage(ch.uploadsPlaylistId, videosPerChannel.value)

      for (const item of items) {
        const vid = item.snippet.resourceId.videoId
        // Skip if we already have it (unless force-refreshing)
        if (!force && existingIds.has(vid)) continue
        // Skip if older than our newest (incremental mode)
        if (!force && newestDate > 0 && new Date(item.snippet.publishedAt).getTime() <= newestDate) continue

        const mapped = mapItem(item, ch.id)
        if (!isShort(mapped)) { allNew.push(mapped); addedCount++ }
      }

      // Update the channel's newestPublishedAt marker
      if (items.length > 0) {
        const latestInFetch = items[0].snippet.publishedAt  // playlist is newest-first
        await fbUpdateChannelNewest(uid.value, ch.id, latestInFetch).catch(() => {})
      }
    }

    newVideosCount.value = addedCount

    let merged
    if (force) {
      // Full refresh: replace per-channel videos, keep others
      const fetchedIds = new Set(allNew.map(v => getVid(v)))
      // Remove old videos for channels we just fetched, add new ones
      const kept = videos.value.filter(v => {
        const inFetchedChannel = channels.value.find(c => c.id === v.snippet.channelId)
        return !inFetchedChannel // keep videos from channels not in our list (edge case)
      })
      merged = [...kept, ...allNew]
    } else {
      // Incremental: prepend new videos to existing list
      merged = [...allNew, ...videos.value]
    }

    // Dedupe by videoId
    const seen = new Set()
    merged = merged.filter(v => { const id = getVid(v); if (seen.has(id)) return false; seen.add(id); return true })
    merged.sort((a, b) => new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt))

    videos.value = merged
    const now = Date.now()
    lastFetchTime.value = now
    syncing.value = true
    await fbSetVideoCache(uid.value, merged)
    await fbSetConfig(uid.value, { lastFetchAt: now })
    syncing.value = false
  } catch (e) {
    error.value = e.message || 'Unknown error'
  } finally {
    loading.value = false
  }
}

async function initialize() {
  if (!apiKey.value || !channels.value.length) return
  const cache = await fbGetVideoCache(uid.value)
  if (cache?.videos && cache.fetchedAt && (Date.now() - cache.fetchedAt) < CACHE_TTL) {
    videos.value = cache.videos
    lastFetchTime.value = cache.fetchedAt
    return
  }
  await fetchAll(false)
}

// ─── Channel management ──────────────────────────────────────────
async function addChannel() {
  const id = channelInput.value.trim()
  if (!id || channels.value.find(c => c.id === id)) { channelInput.value = ''; return }
  addingChannel.value = true; error.value = null
  try {
    const info = await resolveChannel(id)
    const ch = { id, name: info.name, uploadsPlaylistId: info.uploadsPlaylistId, hiddenFromAll: false }
    channels.value.push(ch)
    await fbAddChannel(uid.value, ch)
    channelInput.value = ''

    loading.value = true; loadingMsg.value = `Loading ${info.name}…`
    const items = await fetchPlaylistPage(info.uploadsPlaylistId, videosPerChannel.value)
    const newVids = items.map(i => mapItem(i, id)).filter(v => !isShort(v) && !videos.value.find(x => getVid(x) === getVid(v)))
    const merged = [...newVids, ...videos.value]
    merged.sort((a, b) => new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt))
    videos.value = merged

    const now = Date.now()
    lastFetchTime.value = now
    syncing.value = true
    await fbSetVideoCache(uid.value, merged)
    await fbSetConfig(uid.value, { lastFetchAt: now })
    syncing.value = false
  } catch (e) { error.value = e.message }
  finally { addingChannel.value = false; loading.value = false }
}

async function removeChannel(id) {
  channels.value = channels.value.filter(c => c.id !== id)
  await fbRemoveChannel(uid.value, id)
  videos.value = videos.value.filter(v => v.snippet.channelId !== id)
  syncing.value = true
  await fbSetVideoCache(uid.value, videos.value).catch(console.warn)
  syncing.value = false
}

async function saveApiKey() {
  apiKey.value = apiKeyInput.value.trim()
  await fbSetConfig(uid.value, { ytApiKey: apiKey.value })
  if (channels.value.length) await initialize()
}

// ─── Player ──────────────────────────────────────────────────────
function loadYTScript() {
  return new Promise(resolve => {
    if (window.YT?.Player) { resolve(); return }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(s)
    window.onYouTubeIframeAPIReady = resolve
  })
}

async function openPlayer(video) {
  activeVideo.value  = video
  const vid          = getVid(video)
  const saved        = progressMap.value[vid] || { watchedSec: 0, totalSec: 0, lastPosition: 0 }
  liveProgress.value = { ...saved }
  document.body.style.overflow = 'hidden'
  await nextTick()
  await loadYTScript()
  if (ytPlayer) { try { ytPlayer.destroy() } catch {} ytPlayer = null }
  stopPoll()
  const startAt = saved.lastPosition > 5 ? Math.max(0, saved.lastPosition - 2) : 0
  const container = document.getElementById('yt-player-container')
  if (!container) return
  const div = document.createElement('div'); div.id = 'yt-player-el'
  container.innerHTML = ''; container.appendChild(div)
  ytPlayer = new window.YT.Player('yt-player-el', {
    videoId: vid, width: '100%', height: '100%',
    playerVars: { autoplay: 1, rel: 0, modestbranding: 1, start: Math.floor(startAt) },
    events: {
      onReady(e) {
        const dur = e.target.getDuration()
        if (dur > 0) { liveProgress.value.totalSec = dur; patchProgress(vid, { totalSec: dur }) }
        sessionStart = Date.now(); startPoll(vid, e.target)
      },
      onStateChange(e) {
        const S = window.YT.PlayerState
        if (e.data === S.PLAYING)  { sessionStart = Date.now(); startPoll(vid, e.target) }
        if (e.data === S.PAUSED || e.data === S.ENDED) { flushSession(vid, e.target); stopPoll() }
      }
    }
  })
}

function startPoll(vid, player) {
  stopPoll()
  pollTimer = setInterval(() => {
    if (!player || typeof player.getCurrentTime !== 'function') return
    const pos = player.getCurrentTime(), dur = player.getDuration() || liveProgress.value.totalSec
    const now = Date.now(), elapsed = sessionStart ? (now - sessionStart) / 1000 : 0
    sessionStart = now
    const prev = progressMap.value[vid]?.watchedSec || 0
    patchProgress(vid, { watchedSec: prev + elapsed, totalSec: dur, lastPosition: pos, watchedAt: now })
    liveProgress.value = { ...progressMap.value[vid] }
    analytics.value.videoWatchSec += elapsed; dFbAnalytics()
  }, 3000)
}

function stopPoll() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null } }

function flushSession(vid, player) {
  if (!sessionStart) return
  const elapsed = (Date.now() - sessionStart) / 1000; sessionStart = null
  const pos = typeof player?.getCurrentTime === 'function' ? player.getCurrentTime() : liveProgress.value.lastPosition
  const dur = typeof player?.getDuration    === 'function' ? player.getDuration()    : liveProgress.value.totalSec
  const prev = progressMap.value[vid]?.watchedSec || 0
  patchProgress(vid, { watchedSec: prev + elapsed, totalSec: dur, lastPosition: pos, watchedAt: Date.now() })
  analytics.value.videoWatchSec += elapsed; dFbAnalytics()
}

function patchProgress(vid, patch) {
  progressMap.value[vid] = { ...(progressMap.value[vid] || {}), ...patch }
  if ((progressMap.value[vid]?.watchedSec || 0) > 4 && activeVideo.value) {
    const wasNew = !historyMap.value[vid]
    historyMap.value[vid] = { videoId: vid, video: activeVideo.value, watchedAt: Date.now() }
    if (wasNew) { analytics.value.videosWatched = Object.keys(historyMap.value).length; dFbAnalytics() }
  }
  dFbProgress()
}

function closePlayer() {
  if (ytPlayer && activeVideo.value) {
    try { flushSession(getVid(activeVideo.value), ytPlayer); ytPlayer.stopVideo(); ytPlayer.destroy() } catch {}
    ytPlayer = null
  }
  stopPoll(); sessionStart = null
  activeVideo.value = null; liveProgress.value = { watchedSec: 0, totalSec: 0, lastPosition: 0 }
  document.body.style.overflow = ''
}

// ─── Clear ───────────────────────────────────────────────────────
async function clearHistory() {
  if (!confirm('Clear watch history and progress?')) return
  historyMap.value = {}; progressMap.value = {}; analytics.value.videosWatched = 0
  await fbSetHistory(uid.value, {}); await fbSetProgress(uid.value, {}); await fbSetAnalytics(uid.value, analytics.value)
}
async function clearAnalytics() {
  if (!confirm('Reset analytics?')) return
  analytics.value = { videosWatched: 0, videoWatchSec: 0, siteBrowseSec: 0 }
  await fbSetAnalytics(uid.value, analytics.value)
}

// ─── Browse timer ─────────────────────────────────────────────────
function startBrowseTimer() {
  browseTimer = setInterval(() => {
    if (!activeVideo.value) { analytics.value.siteBrowseSec += 5; dFbAnalytics() }
  }, 5000)
}

// ─── Keyboard ────────────────────────────────────────────────────
function onKey(e) {
  if (e.key === 'Escape') {
    if (channelSheetOpen.value) { channelSheetOpen.value = false; return }
    if (activeVideo.value) closePlayer()
  }
}

// ─── Init ────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    uid.value = await ensureAuth()
    const [cfg, chs, prog, hist, anl, savedData] = await Promise.all([
      fbGetConfig(uid.value), fbGetChannels(uid.value),
      fbGetProgress(uid.value), fbGetHistory(uid.value),
      fbGetAnalytics(uid.value), fbGetSaved(uid.value)
    ])
    apiKey.value           = cfg.ytApiKey || ''
    apiKeyInput.value      = apiKey.value
    lastFetchTime.value    = cfg.lastFetchAt || null
    pageSizeRef.value      = cfg.pageSize || 12
    videosPerChannel.value = cfg.videosPerChannel || 10
    channels.value         = chs
    progressMap.value      = prog
    historyMap.value       = hist
    analytics.value        = anl
    watchLater.value       = savedData.watchLater || {}
    bookmarks.value        = savedData.bookmarks  || {}
    appState.value = 'ready'
    await initialize()
    window.addEventListener('keydown', onKey)
    startBrowseTimer()
  } catch (e) {
    initError.value = e.message || String(e)
    appState.value  = 'error'
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  if (browseTimer) clearInterval(browseTimer)
  stopPoll()
  clearTimeout(fbProgressDebounce); clearTimeout(fbAnalyticsDebounce); clearTimeout(fbSavedDebounce)
})
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

:root {
  --bg:           #0e0e10;
  --surface:      #16161a;
  --card-bg:      #1c1c21;
  --thumb-bg:     #111114;
  --border:       #2a2a32;
  --accent:       #c8a96e;
  --accent-dim:   rgba(200,169,110,0.12);
  --text-primary: #e8e6e0;
  --text-muted:   #8c8a84;
  --text-faint:   #54524e;
  --danger:       #e05050;
  --green:        #4caf82;
  --font-display: 'Playfair Display', Georgia, serif;
  --font-body:    'DM Sans', 'Helvetica Neue', sans-serif;
  --radius:       4px;
  --header-h:     52px;
  --strip-h:      42px;
  --nav-h:        64px;
}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:var(--font-body);background:var(--bg);color:var(--text-primary);min-height:100dvh;-webkit-font-smoothing:antialiased}

/* Splash */
.splash{min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
.splash-logo{width:52px;height:52px;color:var(--accent)}.splash-logo svg{width:100%;height:100%}
.splash-name{font-family:var(--font-display);font-size:1.6rem;font-weight:400;letter-spacing:-.02em}
.splash-name em{font-style:italic;color:var(--accent)}
.splash-loader{width:28px;height:28px;border-radius:50%;border:2px solid var(--border);border-top-color:var(--accent);animation:spin .75s linear infinite;margin-top:8px}

/* Header */
.site-header{position:sticky;top:0;z-index:90;height:var(--header-h);background:rgba(14,14,16,.95);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid var(--border)}
.header-inner{max-width:1200px;margin:0 auto;padding:0 16px;height:100%;display:flex;align-items:center;justify-content:space-between}
.logo{display:flex;align-items:center;gap:9px}
.logo-icon{width:24px;height:24px;color:var(--accent)}
.logo-text{font-family:var(--font-display);font-size:1.2rem;font-weight:400;letter-spacing:-.01em}
.logo-text em{font-style:italic;color:var(--accent)}
.header-right{display:flex;align-items:center;gap:8px}
.cache-pill{font-size:.68rem;color:var(--text-faint);background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:3px 10px}
.sync-pill{font-size:.68rem;color:var(--accent);background:var(--accent-dim);border:1px solid rgba(200,169,110,.25);border-radius:20px;padding:3px 10px;display:flex;align-items:center;gap:5px}
.sync-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:pulse 1s ease infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}

/* Channel Strip */
.channel-strip-wrap{position:sticky;top:var(--header-h);z-index:80;background:rgba(14,14,16,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--border);height:var(--strip-h)}
.channel-strip{display:flex;align-items:center;gap:6px;padding:0 16px;height:100%;overflow:scroll}
.channel-chip{flex-shrink:0;height:26px;padding:0 12px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-muted);font-family:var(--font-body);font-size:.75rem;font-weight:500;cursor:pointer;white-space:nowrap;transition:all .15s ease}
.channel-chip:hover{border-color:var(--accent);color:var(--text-primary)}
.channel-chip.active{background:var(--accent);border-color:var(--accent);color:#0e0e10;font-weight:600}
.channel-chip--more{display:flex;align-items:center;gap:5px;border-style:dashed;color:var(--text-faint)}
.channel-chip--more:hover{border-color:var(--accent);color:var(--accent);border-style:solid}

/* Channel Picker Sheet */
.sheet-backdrop{position:fixed;inset:0;z-index:150;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:flex-end}
.sheet{width:100%;max-height:80dvh;background:var(--surface);border-top:1px solid var(--border);border-radius:16px 16px 0 0;display:flex;flex-direction:column;overflow:hidden}
.sheet-header{padding:16px 16px 12px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:10px;flex-shrink:0}
.sheet-title{font-family:var(--font-display);font-size:1rem;font-weight:400}
.sheet-search{display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:0 12px;height:36px}
.sheet-search-input{flex:1;background:transparent;border:none;outline:none;font-family:var(--font-body);font-size:.85rem;color:var(--text-primary)}
.sheet-search-input::placeholder{color:var(--text-faint)}
.sheet-close{position:absolute;top:14px;right:14px;width:30px;height:30px;border-radius:50%;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center}
.sheet-close svg{width:14px;height:14px}
.sheet-body{overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:2px}
.sheet-channel-btn{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:var(--radius);border:none;background:transparent;color:var(--text-primary);font-family:var(--font-body);font-size:.86rem;cursor:pointer;text-align:left;transition:background .1s}
.sheet-channel-btn:hover{background:var(--card-bg)}
.sheet-channel-btn.active{background:var(--accent-dim)}
.sheet-channel-btn.dimmed .sheet-ch-name{color:var(--text-faint)}
.sheet-ch-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.sheet-ch-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.sheet-ch-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sheet-ch-hidden{font-size:.62rem;color:var(--text-faint)}
.sheet-empty{text-align:center;padding:24px;font-size:.82rem;color:var(--text-faint);font-style:italic}

/* Sheet transition */
.sheet-enter-active,.sheet-leave-active{transition:transform .28s cubic-bezier(.32,0,.67,0)}
.sheet-enter-active .sheet,.sheet-leave-active .sheet{transition:transform .28s cubic-bezier(.32,0,.67,0)}
.sheet-enter-from,.sheet-leave-to{opacity:0}
.sheet-enter-from .sheet,.sheet-leave-to .sheet{transform:translateY(100%)}

/* Bottom Nav — 4 items */
.bottom-nav{position:fixed;bottom:0;left:0;right:0;z-index:90;height:var(--nav-h);background:rgba(14,14,18,.98);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-top:1px solid var(--border);display:flex;align-items:stretch}
.nav-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:transparent;border:none;color:var(--text-faint);font-family:var(--font-body);font-size:.58rem;font-weight:500;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;position:relative;transition:color .15s;padding-bottom:env(safe-area-inset-bottom,0)}
.nav-item svg{width:20px;height:20px}
.nav-item.active{color:var(--accent)}
.nav-item.active svg{filter:drop-shadow(0 0 5px rgba(200,169,110,.4))}
.nav-badge{position:absolute;top:6px;right:calc(50% - 22px);min-width:16px;height:16px;background:var(--accent);color:#0e0e10;font-size:.55rem;font-weight:700;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px}

/* Saved sub-tabs */
.sub-tabs{display:flex;gap:0;margin-bottom:20px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.sub-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;background:var(--card-bg);border:none;color:var(--text-muted);font-family:var(--font-body);font-size:.78rem;font-weight:500;cursor:pointer;transition:background .15s,color .15s;border-right:1px solid var(--border)}
.sub-tab:last-child{border-right:none}
.sub-tab:hover{color:var(--text-primary)}
.sub-tab.active{background:var(--accent-dim);color:var(--accent)}
.sub-tab-count{font-size:.65rem;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1px 6px;min-width:20px;text-align:center}
.sub-tab.active .sub-tab-count{background:var(--accent);border-color:var(--accent);color:#0e0e10}

/* Main */
.app-main{max-width:1200px;margin:0 auto;padding:22px 16px calc(var(--nav-h) + 20px)}

/* Feed meta */
.feed-meta{margin-bottom:16px;font-size:.75rem;color:var(--text-faint);display:flex;align-items:center;gap:0;flex-wrap:wrap}
.feed-count{color:var(--text-muted);font-weight:500}
.feed-unwatched{color:var(--accent)}
.feed-hidden-note{color:var(--text-faint);font-style:italic}
.feed-new-badge{margin-left:8px;font-size:.65rem;font-weight:600;background:rgba(76,175,130,.15);color:var(--green);border:1px solid rgba(76,175,130,.3);border-radius:10px;padding:1px 8px}

/* Grid */
.video-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(285px,1fr));gap:16px}

/* Load more */
.load-more-row{display:flex;justify-content:center;padding:28px 0 8px}
.btn-load-more{display:flex;align-items:center;gap:10px;padding:0 22px;height:40px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-muted);font-family:var(--font-body);font-size:.82rem;cursor:pointer;transition:all .15s}
.btn-load-more:hover{border-color:var(--accent);color:var(--text-primary);background:var(--accent-dim)}
.load-more-count{font-size:.68rem;color:var(--text-faint);background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:1px 7px}
.all-loaded-note{text-align:center;padding:24px 0 8px;font-size:.74rem;color:var(--text-faint)}

/* State screen */
.state-screen{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:72px 20px;gap:14px}
.state-icon{font-size:2.4rem}
.state-screen h2{font-family:var(--font-display);font-size:1.3rem;font-weight:400}
.state-screen p{font-size:.87rem;color:var(--text-muted);max-width:310px;line-height:1.65}
.error-msg{color:var(--danger)!important;font-family:monospace;font-size:.76rem!important;background:rgba(224,80,80,.08);border:1px solid rgba(224,80,80,.2);border-radius:var(--radius);padding:10px 16px}
.loader{width:30px;height:30px;border-radius:50%;border:2px solid var(--border);border-top-color:var(--accent);animation:spin .75s linear infinite}
.loading-text{font-size:.8rem;color:var(--text-faint)!important}
@keyframes spin{to{transform:rotate(360deg)}}

/* Settings */
.settings-inner{display:flex;flex-direction:column;gap:28px}
.settings-section{display:flex;flex-direction:column;gap:12px}
.settings-title{font-family:var(--font-display);font-size:1rem;font-weight:400;color:var(--text-primary);padding-bottom:10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px}
.title-count{font-family:var(--font-body);font-size:.7rem;font-weight:600;background:var(--accent-dim);color:var(--accent);border:1px solid rgba(200,169,110,.25);border-radius:10px;padding:1px 8px;margin-left:auto}
.hint-text{font-size:.74rem;color:var(--text-faint);line-height:1.5}
.hint-text strong{color:var(--text-muted)}
.empty-note{font-size:.8rem;color:var(--text-faint);font-style:italic}
.add-channel-row{display:flex;gap:8px;align-items:center}
.quota-info{display:flex;align-items:flex-start;gap:6px;font-size:.72rem;color:var(--text-faint);line-height:1.5;padding:8px 12px;background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius)}
.channel-list{list-style:none;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.channel-item{display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--card-bg);border-bottom:1px solid var(--border);transition:background .1s}
.channel-item:last-child{border-bottom:none}
.channel-item--hidden{background:var(--bg)}
.channel-item--hidden .channel-name{color:var(--text-faint)}
.channel-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.channel-name{font-size:.86rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.channel-id-badge{font-size:.6rem;font-family:monospace;color:var(--text-faint)}
.hidden-tag{font-size:.6rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint);background:var(--surface);border:1px solid var(--border);border-radius:3px;padding:2px 6px;flex-shrink:0}
.btn-eye{width:30px;height:30px;border-radius:var(--radius);border:1px solid transparent;background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
.btn-eye svg{width:15px;height:15px}
.btn-eye:hover{color:var(--accent);border-color:var(--accent);background:var(--accent-dim)}
.btn-eye--off{color:var(--text-faint)}
.btn-expand-channels{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:9px;border:1px dashed var(--border);border-radius:var(--radius);background:transparent;color:var(--text-muted);font-family:var(--font-body);font-size:.76rem;cursor:pointer;transition:color .15s,border-color .15s;margin-top:-4px}
.btn-expand-channels:hover{color:var(--accent);border-color:var(--accent)}
.quota-detail{display:flex;flex-direction:column;gap:10px;padding:14px;background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius)}
.quota-row{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:.82rem;color:var(--text-muted)}
.stepper{display:flex;align-items:center;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.stepper-btn{width:30px;height:28px;background:transparent;border:none;color:var(--text-muted);font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .1s,color .1s}
.stepper-btn:hover:not(:disabled){background:var(--accent-dim);color:var(--accent)}
.stepper-btn:disabled{opacity:.35;cursor:not-allowed}
.stepper-val{min-width:32px;text-align:center;font-size:.82rem;font-weight:600;color:var(--text-primary);border-left:1px solid var(--border);border-right:1px solid var(--border);padding:0 4px;line-height:28px}
.cache-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.cache-info{font-size:.77rem;color:var(--text-faint);line-height:1.5}
.firebase-status-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius)}
.fb-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.fb-dot--ok{background:var(--green);box-shadow:0 0 6px var(--green)}
.fb-dot--err{background:var(--danger)}
.fb-label{font-size:.72rem;color:var(--text-muted);font-family:monospace}
.analytics-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.stat-card{background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius);padding:16px 14px}
.accent-card{border-color:var(--accent);background:var(--accent-dim)}
.stat-value{font-family:var(--font-display);font-size:1.55rem;font-weight:400;color:var(--text-primary);line-height:1;margin-bottom:6px}
.accent-card .stat-value{color:var(--accent)}
.stat-label{font-size:.67rem;color:var(--text-muted);letter-spacing:.05em;text-transform:uppercase}
.analytics-bar-wrap{display:flex;flex-direction:column;gap:8px;padding:14px;background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius)}
.bar-label,.bar-sub{display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-muted)}
.bar-sub{color:var(--text-faint)}
.analytics-bar{height:6px;border-radius:3px;background:var(--border);overflow:hidden}
.bar-fill{height:100%;border-radius:3px;background:var(--accent);transition:width .6s ease}
.clear-row{display:flex;gap:10px;flex-wrap:wrap;padding-top:4px}

/* Buttons */
.btn-primary{padding:0 16px;height:36px;border-radius:var(--radius);border:none;background:var(--accent);color:#0e0e10;font-family:var(--font-body);font-size:.78rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:opacity .15s}
.btn-primary:hover:not(:disabled){opacity:.85}
.btn-primary:disabled{opacity:.4;cursor:not-allowed}
.btn-ghost{padding:0 14px;height:36px;border-radius:var(--radius);border:1px solid var(--border);background:transparent;color:var(--text-muted);font-family:var(--font-body);font-size:.78rem;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:color .15s,border-color .15s}
.btn-ghost:hover:not(:disabled){color:var(--text-primary);border-color:var(--text-muted)}
.btn-ghost:disabled{opacity:.4;cursor:not-allowed}
.btn-danger{color:var(--danger)!important;border-color:rgba(224,80,80,.3)!important}
.btn-danger:hover{border-color:var(--danger)!important;background:rgba(224,80,80,.08)!important}
.btn-icon{width:34px;height:34px;border-radius:var(--radius);border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
.btn-icon svg{width:16px;height:16px}
.btn-icon:hover{color:var(--accent);border-color:var(--accent);background:var(--accent-dim)}
.btn-remove{width:28px;height:28px;border-radius:50%;border:none;background:transparent;color:var(--text-faint);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:color .15s,background .15s}
.btn-remove svg{width:13px;height:13px}
.btn-remove:hover{color:var(--danger);background:rgba(224,80,80,.1)}
.text-input{flex:1;min-width:0;height:36px;padding:0 12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-family:var(--font-body);font-size:.87rem;outline:none;transition:border-color .15s}
.text-input::placeholder{color:var(--text-faint)}
.text-input:focus{border-color:var(--accent)}

/* Modal */
.modal-backdrop{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:12px}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:6px;width:100%;max-width:860px;max-height:95dvh;overflow-y:auto;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,.7)}
.modal-header{display:flex;align-items:flex-start;gap:14px;padding:16px 16px 14px;border-bottom:1px solid var(--border)}
.modal-meta{flex:1;min-width:0}
.modal-channel{font-size:.67rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:5px}
.modal-title{font-family:var(--font-display);font-size:1.02rem;font-weight:400;line-height:1.35;color:var(--text-primary)}
.modal-progress-track{height:3px;background:var(--border);flex-shrink:0}
.modal-progress-fill{height:100%;background:var(--accent);transition:width 3s linear}
.iframe-wrap{position:relative;padding-bottom:56.25%;height:0;overflow:hidden;background:#000}
#yt-player-container{position:absolute;inset:0;width:100%;height:100%}
#yt-player-container iframe{width:100%;height:100%;border:none}
.modal-progress-label{display:flex;align-items:center;gap:6px;padding:8px 16px;font-size:.71rem;color:var(--text-muted);border-top:1px solid var(--border)}
.modal-desc{padding:14px 16px 18px;border-top:1px solid var(--border)}
.modal-desc p{font-size:.79rem;line-height:1.65;color:var(--text-muted)}

/* Transitions */
.fade-enter-active,.fade-leave-active{transition:opacity .2s ease}
.fade-enter-from,.fade-leave-to{opacity:0}

/* Responsive */
@media(max-width:640px){
  .video-grid{grid-template-columns:1fr;gap:13px}
  .analytics-grid{grid-template-columns:1fr 1fr}
  .modal-title{font-size:.9rem}
  .add-channel-row{flex-wrap:wrap}
  .add-channel-row .text-input{min-width:100%}
}
@media(max-width:380px){.analytics-grid{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
</style>
