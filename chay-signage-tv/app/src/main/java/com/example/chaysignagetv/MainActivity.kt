package com.example.chaysignagetv

import android.annotation.SuppressLint
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.webkit.WebChromeClient
import android.webkit.WebResourceResponse
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView

private const val LIVE_PLAYER_URL = "https://tv.chaychaupal.com/screen"
private const val APK_PLAYER_VERSION = "20260523-v3"

class MainActivity : ComponentActivity() {

    private var webView: WebView? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var lastLoadStartedAt = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            var isError by remember { mutableStateOf(false) }
            var errorMessage by remember { mutableStateOf("") }

            Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { context ->
                        WebView(context).apply {
                            webView = this
                            setupWebView(this)
                            webChromeClient = WebChromeClient()
                            webViewClient = object : WebViewClient() {
                                override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                                    super.onPageStarted(view, url, favicon)
                                    lastLoadStartedAt = System.currentTimeMillis()
                                }

                                override fun onPageFinished(view: WebView?, url: String?) {
                                    super.onPageFinished(view, url)
                                    isError = false
                                    scheduleBlankScreenRecovery(view)
                                }

                                override fun onReceivedError(
                                    view: WebView?,
                                    request: WebResourceRequest?,
                                    error: WebResourceError?
                                ) {
                                    super.onReceivedError(view, request, error)
                                    if (request?.isForMainFrame == true) {
                                        isError = true
                                        errorMessage = error?.description?.toString() ?: "Network connection error"
                                    }
                                }

                                override fun onReceivedHttpError(
                                    view: WebView?,
                                    request: WebResourceRequest?,
                                    errorResponse: WebResourceResponse?
                                ) {
                                    super.onReceivedHttpError(view, request, errorResponse)
                                    if (request?.isForMainFrame == true) {
                                        isError = true
                                        errorMessage = "HTTP ${errorResponse?.statusCode ?: "error"}"
                                    }
                                }
                            }
                            loadPlayer()
                        }
                    },
                    update = { view ->
                        if (!isError && view.url.isNullOrBlank()) {
                            view.loadPlayer()
                        }
                    }
                )

                if (isError) {
                    ErrorScreen(
                        message = errorMessage,
                        onRetry = {
                            isError = false
                            webView?.loadPlayer()
                        }
                    )
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView(webView: WebView) {
        webView.setBackgroundColor(0)
        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_NO_CACHE
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            userAgentString = "$userAgentString ChaySignageTV/$APK_PLAYER_VERSION"
        }
        WebView.setWebContentsDebuggingEnabled(false)
        webView.clearCache(true)
        webView.scrollBarStyle = WebView.SCROLLBARS_OUTSIDE_OVERLAY
        webView.isScrollbarFadingEnabled = true
        webView.keepScreenOn = true
        webView.setOnLongClickListener { true }
    }

    private fun playerUrl(): String {
        return "$LIVE_PLAYER_URL?apk=$APK_PLAYER_VERSION&t=${System.currentTimeMillis()}"
    }

    private fun WebView.loadPlayer() {
        lastLoadStartedAt = System.currentTimeMillis()
        clearCache(true)
        loadUrl(
            playerUrl(),
            mapOf(
                "Cache-Control" to "no-cache, no-store, max-age=0",
                "Pragma" to "no-cache"
            )
        )
    }

    private fun scheduleBlankScreenRecovery(view: WebView?) {
        if (view == null) return

        mainHandler.postDelayed({
            val currentView = webView ?: return@postDelayed
            if (currentView != view) return@postDelayed

            currentView.evaluateJavascript(
                """
                (() => {
                  const body = document.body;
                  const htmlLength = body ? body.innerHTML.length : 0;
                  const hasVisibleMedia = !!document.querySelector('video, img, iframe, canvas');
                  const text = body ? body.innerText.trim() : '';
                  return JSON.stringify({ htmlLength, hasVisibleMedia, textLength: text.length, readyState: document.readyState });
                })()
                """.trimIndent()
            ) { rawResult ->
                val htmlLength = Regex(""""htmlLength":(\d+)""").find(rawResult ?: "")?.groupValues?.getOrNull(1)?.toIntOrNull() ?: 0
                val hasVisibleMedia = rawResult?.contains(""""hasVisibleMedia":true""") == true
                val textLength = Regex(""""textLength":(\d+)""").find(rawResult ?: "")?.groupValues?.getOrNull(1)?.toIntOrNull() ?: 0
                val stuckForMs = System.currentTimeMillis() - lastLoadStartedAt

                if (stuckForMs > 10_000 && htmlLength < 500 && !hasVisibleMedia && textLength == 0) {
                    currentView.loadPlayer()
                }
            }
        }, 12_000)
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
        webView?.resumeTimers()
    }

    override fun onPause() {
        webView?.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        mainHandler.removeCallbacksAndMessages(null)
        webView?.destroy()
        webView = null
        super.onDestroy()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_MENU) {
            webView?.loadPlayer()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }
}

@Composable
fun ErrorScreen(message: String, onRetry: () -> Unit) {
    val retryFocusRequester = remember { FocusRequester() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xEE000000)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier
                .widthIn(max = 460.dp)
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xFF111116))
                .border(
                    1.dp,
                    Brush.linearGradient(listOf(Color(0x33FFFFFF), Color(0x08FFFFFF))),
                    RoundedCornerShape(24.dp)
                )
                .padding(32.dp)
        ) {
            Text(
                text = "Connection Error",
                color = Color(0xFFEF5350),
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "Could not connect to the live signage player. Check the device internet connection and try again.\n\nError: $message",
                color = Color(0xFFE0E0E6),
                fontSize = 14.sp,
                lineHeight = 22.sp
            )
            Spacer(modifier = Modifier.height(24.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                TvButton(
                    text = "Retry",
                    onClick = onRetry,
                    focusRequester = retryFocusRequester,
                    modifier = Modifier.width(180.dp)
                )
            }
        }
    }

    LaunchedEffect(Unit) {
        retryFocusRequester.requestFocus()
    }
}

@Composable
fun TvButton(
    text: String,
    onClick: () -> Unit,
    focusRequester: FocusRequester? = null,
    modifier: Modifier = Modifier
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    val baseModifier = if (focusRequester != null) {
        modifier.focusRequester(focusRequester)
    } else {
        modifier
    }

    Box(
        modifier = baseModifier
            .height(48.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(
                if (isFocused) {
                    Brush.linearGradient(listOf(Color(0xFFFFC400), Color(0xFFE0A800)))
                } else {
                    Brush.linearGradient(listOf(Color(0x1AFFFFFF), Color(0x0AFFFFFF)))
                }
            )
            .border(
                1.dp,
                if (isFocused) Color.White else Color(0x1FFFFFFF),
                RoundedCornerShape(12.dp)
            )
            .focusable(interactionSource = interactionSource)
            .clickable(interactionSource = interactionSource, indication = null) { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = if (isFocused) Color.Black else Color.White,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold
        )
    }
}
