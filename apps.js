import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  Linking,
  Alert,
  RefreshControl,
  useColorScheme,
  Share,

} from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import * as rssParser from 'react-native-rss-parser';
import { WebView } from 'react-native-webview';
import SplashScreen from "./SplashScreen";


// ---------- NAV ----------
const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();

// ---------- DATA ----------
const categories = [
  { name: 'Home', rss: 'https://thesun.my/rss/home' },
  { name: 'News', rss: 'https://thesun.my/rss/local' },
  { name: 'Viral', rss: 'https://thesun.my/rss/viral' },
  { name: 'Business', rss: 'https://thesun.my/rss/business' },
  { name: 'Sports', rss: 'https://thesun.my/rss/sport' },
  { name: 'Lifestyle', rss: 'https://thesun.my/rss/style-life' },
  { name: 'Berita', rss: 'https://thesun.my/rss/berita' },
  { name: 'Opinion', rss: 'https://thesun.my/rss/opinion' },
  { name: 'Spotlight', rss: 'https://thesun.my/rss/spotlight' },
  { name: 'Education', rss: 'https://thesun.my/rss/education' },
  { name: 'Motoring', rss: 'https://thesun.my/rss/gear-up' },
  { name: 'Images', rss: 'https://thesun.my/rss/images' },
];

// ---------- HELPERS ----------
function extractImageFromContent(content) {
  const match = content?.match(/<img[^>]+src=\"([^">]+)\"/);
  return match?.[1] ?? 'https://via.placeholder.com/100x60?text=No+Image';
}

function cleanDescription(content) {
  return content
    ?.replace(/<img[^>]*>/g, '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .trim();
}

// Bold ALL-CAPS location-like words (kept as-is)
function highlightLocation(text) {
  return text?.replace(/\b([A-Z]{2,}(?:\s+[A-Z]{2,})*)\b/g, (match) => `**${match}**`) ?? '';
}

// show only date, remove time
// tarikh + "berapa lama lepas"
function formatDate(dateString) {
  const d = new Date(dateString);
  if (isNaN(d)) return dateString || '';

  // Format tarikh ikut "DD MMM YYYY"
  const datePart = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Kira perbezaan masa
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  let ago = '';
  if (diffMin < 1) {
    ago = 'just now';
  } else if (diffMin < 60) {
    ago = `${diffMin}m ago`;
  } else if (diffHr < 24) {
    ago = `${diffHr}h ago`;
  } else {
    ago = `${diffDay}d ago`;
  }

  return `${datePart} • ${ago}`;
}


// ---------- BOOKMARK CONTEXT ----------
const BookmarksContext = createContext();

function BookmarksProvider({ children }) {
  const [bookmarks, setBookmarks] = useState([]);

  const isBookmarked = useCallback(
    (url) => bookmarks.some((b) => b?.url === url),
    [bookmarks]
  );

  const addBookmark = useCallback((article) => {
    if (!article?.url) return;
    setBookmarks((prev) => {
      if (prev.some((a) => a.url === article.url)) return prev;
      return [article, ...prev];
    });
    Alert.alert('✅ Saved', 'This article has been saved!');
  }, []);

  const removeBookmark = useCallback((url) => {
    setBookmarks((prev) => prev.filter((a) => a.url !== url));
  }, []);

  const value = useMemo(() => ({ bookmarks, addBookmark, removeBookmark, isBookmarked }), [bookmarks, addBookmark, removeBookmark, isBookmarked]);

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}

function useBookmarks() {
  return useContext(BookmarksContext);
}

// ---------- THEME ----------
const palette = {
  primary: '#e30613',
  green: '#005321',
  textLight: '#333',
  textDim: '#777',
  border: '#ccc',
};

function useThemedStyles(isDark) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#0b0b0b' : '#fff' },
    header: {
      backgroundColor: isDark ? '#121212' : '#fff',
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? '#222' : '#eee',
    },
    logo: { width: 160, height: 40 },
    headerIcons: { flexDirection: 'row', marginLeft: 'auto' },
    headerIcon: { fontSize: 20, marginLeft: 12 },
    categoryBar: {
      backgroundColor: isDark ? '#101010' : '#fff',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderColor: isDark ? '#222' : palette.border,
    },
    categoryButton: { marginHorizontal: 10 },
    categoryText: { fontSize: 16, color: isDark ? '#bbb' : '#555' },
    selectedCategoryText: { color: palette.primary, fontWeight: 'bold' },

    iPaperButton: {
      backgroundColor: palette.green,
      margin: 15,
      padding: 12,
      borderRadius: 10,
      alignItems: 'center',
    },
    iPaperButtonText: { color: '#fff', fontSize: 16 },

    drawerLabel: { color: 'white', fontWeight: 'bold' },

    articleContainer: { marginBottom: 20 },
    articleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    thumbnail: { width: 100, height: 60, borderRadius: 5, backgroundColor: isDark ? '#222' : '#eee' },
    featuredArticle: { marginBottom: 30 },
    featuredImage: { width: '100%', height: 200, borderRadius: 10, marginBottom: 10, backgroundColor: isDark ? '#222' : '#eee' },
    featuredTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 5, color: isDark ? '#fff' : palette.textLight },
    articleTitle: { fontSize: 20, fontWeight: 'bold', marginVertical: 5, color: isDark ? '#fff' : palette.textLight },
    articleDate: { fontSize: 14, color: isDark ? '#aaa' : palette.textDim, marginBottom: 5 },
    articleText: { fontSize: 16, lineHeight: 24, color: isDark ? '#e1e1e1' : palette.textLight, marginTop: 8 },

    tagRow: { flexDirection: 'row', alignItems: 'center' },
    tagBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? '#333' : '#ddd',
      marginLeft: 10,
    },
    tagBtnText: { color: isDark ? '#eee' : '#333', fontSize: 12 },

    bookmarkBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: isDark ? '#333' : '#ddd',
      alignSelf: 'flex-start',
      marginTop: 6,
    },
    bookmarkBtnText: { color: isDark ? '#ddd' : '#333' },

    removeBtn: { backgroundColor: '#777', padding: 8, borderRadius: 6, marginTop: 6 },
    removeBtnText: { color: '#fff', textAlign: 'center' },

    openBtn: { backgroundColor: palette.primary, marginTop: 15, padding: 10, borderRadius: 6 },
    openBtnText: { color: '#fff', textAlign: 'center' },

    emptyText: { color: isDark ? '#aaa' : palette.textDim, padding: 10, textAlign: 'center' },
  });
}

// ---------- SCREENS ----------
function HomeScreen({ navigation, route }) {
  const sysScheme = useColorScheme();
  const [manualDark, setManualDark] = useState(false);
  const isDark = manualDark || sysScheme === 'dark';
  const styles = useThemedStyles(isDark);

  const [selectedIndex, setSelectedIndex] = useState(1);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { addBookmark, removeBookmark, isBookmarked } = useBookmarks();

  const currentRSS = categories[selectedIndex].rss;

  const mergeArticles = useCallback((oldItems, newItems) => {
    // dedupe by URL (links[0]?.url)
    const seen = new Set(oldItems.map((a) => a?.links?.[0]?.url || a?.url));
    const mergedNew = [];
    for (const it of newItems) {
      const url = it?.links?.[0]?.url || it?.url;
      if (!seen.has(url)) {
        mergedNew.push(it);
        seen.add(url);
      }
    }
    // new first, keep existing after
    return [...mergedNew, ...oldItems];
  }, []);

  // ---------- UPDATED PART: fetchRSS now extracts ALL <p> and stores paragraphs + fullContent ----------
  const fetchRSS = useCallback(async (url, { merge = false } = {}) => {
    try {
      if (!merge) setLoading(true);
      const response = await fetch(url);
      const text = await response.text();
      const feed = await rssParser.parse(text);

      const mappedItems = feed.items.map((it) => {
        // 1) PILIH gambar utamakan <media:content> (biasanya ada dalam enclosures) -> pilih yang imej
        const enc = Array.isArray(it.enclosures) ? it.enclosures : [];
        const fromEncImage =
          enc.find((e) =>
            typeof e?.mimeType === 'string'
              ? e.mimeType.toLowerCase().includes('image')
              : /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(String(e?.url || ''))
          )?.url;

        // 2) Fallback: cuba korek <img> dalam description
        const rawDescForImg = it.description || '';
        const fromDescImg = extractImageFromContent(rawDescForImg);

        const finalImage = fromEncImage || (fromDescImg?.includes('placeholder.com') ? null : fromDescImg) || null;

        // Jika tiada enclosures imej, masukkan yang dipilih supaya UI sedia ada (ambil enclosures[0].url) terus berfungsi
        const ensuredEnclosures =
          finalImage
            ? [{ url: finalImage, length: 0, mimeType: 'image/*' }, ...enc.filter(e => e?.url !== finalImage)]
            : enc;

        // 3) Ambil TEKS: ambil semua <p> dari description/content, bersihkan HTML
        const rawDesc = it.description || it.content || it.contentSnippet || '';

        // cari semua <p>...</p>
        const pMatches = [];
        const regex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
        let m;
        while ((m = regex.exec(rawDesc)) !== null) {
          if (m[1]) pMatches.push(m[1]);
        }

        // bersihkan setiap <p>
        let paragraphs = pMatches.map((p) => cleanDescription(p)).filter(Boolean);

        // fallback jika tiada <p> — gunakan keseluruhan teks dibersihkan
        const cleanedPlain = cleanDescription(rawDesc);
        if (paragraphs.length === 0) {
          // split pada double newlines jika ada, else gunakan full cleaned plain
          const possibleParas = cleanedPlain.split(/\n{2,}|\r\n{2,}/).map(s => s.trim()).filter(Boolean);
          paragraphs = possibleParas.length > 0 ? possibleParas : (cleanedPlain ? [cleanedPlain] : []);
        }

        const firstParagraph = paragraphs.length > 0 ? paragraphs[0] : '';
        const fullContent = paragraphs.join('\n\n');

        return {
          ...it,
          enclosures: ensuredEnclosures,
          // keep content as first paragraph for list/snippet usage
          content: firstParagraph,
          contentSnippet: firstParagraph,
          // add paragraphs + fullContent for full article view
          paragraphs,
          fullContent,
        };
      });

      setArticles((prev) => (merge ? mergeArticles(prev, mappedItems) : mappedItems));
    } catch (error) {
      console.error('RSS fetch error:', error);
    } finally {
      if (!merge) setLoading(false);
    }
  }, [mergeArticles]);
  // ---------- END UPDATED PART ----------

  useEffect(() => {
    fetchRSS(currentRSS);
  }, [currentRSS, fetchRSS]);

  // Auto-refresh every 5 minutes: merge only NEW items on top
  useEffect(() => {
    const id = setInterval(() => {
      fetchRSS(currentRSS, { merge: true });
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [currentRSS, fetchRSS]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRSS(currentRSS, { merge: true });
    setRefreshing(false);
  }, [currentRSS, fetchRSS]);

  const toggleTheme = () => setManualDark((v) => !v);



  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} activeOpacity={0.7}>
          <Text style={{ fontSize: 28, color: isDark ? '#fff' : '#000' }}>☰</Text>
        </TouchableOpacity>

        <Image
          source={{ uri: 'https://sunmedia.com.my/wp-content/uploads/2025/07/theSun-Logo-Website-350x180-2.png' }}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('Saved')} activeOpacity={0.8}>
            <Text style={[styles.headerIcon, { color: isDark ? '#fff' : '#000' }]}>🔖</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTheme} activeOpacity={0.8}>
            <Text style={[styles.headerIcon, { color: isDark ? '#fff' : '#000' }]}>{isDark ? '🌙' : '🔆'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Categories */}
      <View style={styles.categoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
          {categories.map((cat, idx) => (
            <TouchableOpacity
              key={cat.name}
              onPress={() => setSelectedIndex(idx)}
              style={styles.categoryButton}
              activeOpacity={0.7}
            >
              <Text style={[styles.categoryText, idx === selectedIndex && styles.selectedCategoryText]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* iPaper */}
      <TouchableOpacity
        style={styles.iPaperButton}
        onPress={() =>
          navigation.navigate('Article', {
            article: {
              title: 'iPaper',
              headline: 'Flipbook Edition',
              content: '',
              image: '',
              url: 'https://thesun-ipaper.cld.bz/',
              isIpaper: true,
            },
          })
        }
        activeOpacity={0.85}
      >
        <Text style={styles.iPaperButtonText}>📰 Open iPaper</Text>
      </TouchableOpacity>

      {/* Articles */}
      <ScrollView
        style={{ padding: 20 }}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={palette.primary} />
        ) : articles.length === 0 ? (
          <Text style={styles.emptyText}>No Article.</Text>
        ) : (
          articles.map((article, index) => {
            const imageUrl = article.enclosures?.[0]?.url || extractImageFromContent(article.content);
            // description uses only the first paragraph (content/contentSnippet)
            const description = cleanDescription(article.contentSnippet);
            const url = article.links?.[0]?.url;

            const bookmarked = isBookmarked(url);

            return (
              <View key={url || index} style={index === 0 ? styles.featuredArticle : styles.articleContainer}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.navigate('Article', {
                      article: {
                        title: article.title,
                        headline: formatDate(article.published),
                        image: imageUrl,
                        // pass full content to ArticleScreen. If fullContent missing, fallback to first paragraph
                        content: article.fullContent || article.content || '',
                        url,
                      },
                    })
                  }
                >
                  {index === 0 ? (
                    <>
                      <Image source={{ uri: imageUrl }} style={styles.featuredImage} />
                      <Text style={styles.featuredTitle}>{article.title}</Text>
                      <Text style={styles.articleDate}>{formatDate(article.published)}</Text>
                      <Text style={styles.articleText}>{description}</Text>
                    </>
                  ) : (
                    <View style={styles.articleRow}>
                      <Image source={{ uri: imageUrl }} style={styles.thumbnail} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.articleTitle}>{article.title}</Text>
                        <Text style={styles.articleDate}>{formatDate(article.published)}</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Bookmark from list */}
               {url ? (
  <View style={{ flexDirection: 'row', justifyContent: 'flex-start' }}>
    {/* Bookmark Button */}
    <TouchableOpacity
      style={[styles.bookmarkBtn, { marginRight: 8 }]} // jarak sikit dengan share
      onPress={() =>
        bookmarked
          ? removeBookmark(url)
          : addBookmark({
              title: article.title,
              headline: formatDate(article.published),
              image: imageUrl,
              url,
            })
      }
      activeOpacity={0.85}
    >
      <Text style={styles.bookmarkBtnText}>
        {bookmarked ? '★ Bookmarked (Remove)' : '☆ Bookmark'}
      </Text>
    </TouchableOpacity>

    {/* Share Button */}
    <TouchableOpacity
      style={styles.bookmarkBtn}
      onPress={async () => {
        try {
          const message = `${article.title}\n\n${url}`;
          await Share.share({ message, url, title: article.title });
        } catch (error) {
          console.error(error.message);
        }
      }}
      activeOpacity={0.85}
    >
      <Text style={styles.bookmarkBtnText}>🔗 Share</Text>
    </TouchableOpacity>
  </View>
) : null}

              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ArticleScreen({ route, navigation }) {
  const { article } = route.params;
  const { addBookmark, removeBookmark, isBookmarked } = useBookmarks();
  const sysScheme = useColorScheme();
  const isDark = sysScheme === 'dark';
  const styles = useThemedStyles(isDark);

  const bookmarked = isBookmarked(article?.url);

if (article?.isIpaper) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>
        <WebView source={{ uri: article.url }} style={{ flex: 1 }} />
      </SafeAreaView>
    );
    }
  // --------- onShare (native share sheet) ----------
  const onShare = async () => {
    try {
      // build message + include url if ada
      const url = article?.url || '';
      const title = article?.title || '';
      const message = title ? `${title}\n\n${url}` : url || 'Check this out';

      // if nothing to share, inform user
      if (!message) {
        Alert.alert('Tiada kandungan', 'Tiada kandungan untuk dikongsi.');
        return;
      }

      // call native share - include both message and url for max compatibility
      await Share.share(
        { message, url, title },
        {
          // Android: use dialogTitle for chooser title (optional)
          dialogTitle: title || 'Share',
        }
      );
    } catch (err) {
      console.error('Share error:', err);
      Alert.alert('Ralat', 'Tidak dapat buka share dialog.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { padding: 15 }]}>
      {/* Header with single Share button + Bookmark */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.featuredTitle}></Text>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Share button (single button) */}
          <TouchableOpacity onPress={onShare} activeOpacity={0.8} style={{ marginRight: 12 }}>
            <Text style={styles.headerIcon}>🔗</Text>

            {/* Gantikan emoji dengan Text "Share" atau ikon jika mahu */}
          </TouchableOpacity>

          {/* Bookmark button */}
          <TouchableOpacity
            onPress={() => (bookmarked ? removeBookmark(article.url) : addBookmark(article))}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 20 }}>{bookmarked ? '⭐' : '💾'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ marginTop: 10 }} nestedScrollEnabled>
        <Text style={styles.articleTitle}>{article.title}</Text>
        <Text style={styles.articleDate}>{article.headline}</Text>

        {!!article.image && (
          <Image source={{ uri: article.image }} style={{ width: '100%', height: 200, borderRadius: 10 }} />
        )}

        <Text style={styles.articleText}>{highlightLocation(article.content)}</Text>

        {!!article.url && (
          <TouchableOpacity onPress={() => Linking.openURL(article.url)} style={styles.openBtn} activeOpacity={0.85}>
            <Text style={styles.openBtnText}>Read on Website</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}



function SavedArticlesScreen() {
  const { bookmarks, removeBookmark } = useBookmarks();
  const sysScheme = useColorScheme();
  const isDark = sysScheme === 'dark';
  const styles = useThemedStyles(isDark);

  return (
    <SafeAreaView style={[styles.container, { padding: 15 }]}>
      <Text style={styles.featuredTitle}>📂 Saved / Bookmarks</Text>

      {bookmarks.length === 0 ? (
        <Text style={styles.emptyText}>No Bookmark.</Text>
      ) : (
        <ScrollView style={{ marginTop: 10 }} nestedScrollEnabled>
          {bookmarks.map((article, index) => (
            <View key={article.url || index} style={{ marginBottom: 12 }}>
              <TouchableOpacity onPress={() => Linking.openURL(article.url)} activeOpacity={0.85}>
                <View style={styles.articleRow}>
                  <Image source={{ uri: article.image }} style={styles.thumbnail} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.articleTitle}>{article.title}</Text>
                    <Text style={styles.articleDate}>{article.headline}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removeBookmark(article.url)}
                style={styles.removeBtn}
                activeOpacity={0.85}
              >
                <Text style={styles.removeBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function CustomDrawerContent(props) {
  const sysScheme = useColorScheme();
  const isDark = sysScheme === 'dark';
  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: '#e30613' }}>
      <DrawerItem
        label="🏠 Home"
        labelStyle={{ color: 'white', fontWeight: 'bold' }}
        onPress={() => props.navigation.navigate('Home')}
      />
      <DrawerItem
        label="💾 Bookmark"
        labelStyle={{ color: 'white', fontWeight: 'bold' }}
        onPress={() => props.navigation.navigate('Saved')}
      />
      <DrawerItem label="👤 Profile" labelStyle={{ color: 'white', fontWeight: 'bold' }} onPress={() => {}} />
      <DrawerItem label="⚙️ Settings" labelStyle={{ color: 'white', fontWeight: 'bold' }} onPress={() => {}} />
    </DrawerContentScrollView>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Article" component={ArticleScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}

function MainApp() {
  return (
    <BookmarksProvider>
      <Drawer.Navigator drawerContent={(props) => <CustomDrawerContent {...props} />}>
        <Drawer.Screen name="Home" component={HomeStack} options={{ headerShown: false }} />
        <Drawer.Screen name="Saved" component={SavedArticlesScreen} />
      </Drawer.Navigator>
    </BookmarksProvider>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="MainApp" component={MainApp} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

