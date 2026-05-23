package com.example.chaysignagetv

import android.annotation.SuppressLint
import android.content.Context
import android.os.Bundle
import android.view.KeyEvent
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
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.focusable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

private const val DEFAULT_SIGNAGE_URL = "https://tv.chaychaupal.com/screen"
private const val SIGNAGE_URL_PREFERENCE = "signage_url_live_screen_v3"

class MainActivity : ComponentActivity() {

    private var webView: WebView? = null
    private var showSettingsState = mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val sharedPref = getSharedPreferences("SignageTVPrefs", Context.MODE_PRIVATE)
        val savedUrl = sharedPref.getString(SIGNAGE_URL_PREFERENCE, DEFAULT_SIGNAGE_URL) ?: DEFAULT_SIGNAGE_URL

        setContent {
            var currentUrl by remember { mutableStateOf(savedUrl) }
            var isError by remember { mutableStateOf(false) }
            var errorMessage by remember { mutableStateOf("") }
            val showSettings by showSettingsState

            Box(modifier = Modifier.fillMaxSize().background(Color(0xFF0D0D11))) {
                // Background Glow Elements for Dark Glassmorphism Theme
                Box(
                    modifier = Modifier
                        .size(350.dp)
                        .align(Alignment.TopEnd)
                        .blur(80.dp)
                        .background(Brush.radialGradient(listOf(Color(0x1F8A2387), Color.Transparent)))
                )
                Box(
                    modifier = Modifier
                        .size(350.dp)
                        .align(Alignment.BottomStart)
                        .blur(80.dp)
                        .background(Brush.radialGradient(listOf(Color(0x1F2B86C5), Color.Transparent)))
                )

                // The Immersive Fullscreen WebView
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { context ->
                        WebView(context).apply {
                            webView = this
                            setupWebView(this)
                            webViewClient = object : WebViewClient() {
                                override fun onPageFinished(view: WebView?, url: String?) {
                                    super.onPageFinished(view, url)
                                    isError = false
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
                            }
                            loadUrl(currentUrl)
                        }
                    },
                    update = { view ->
                        if (!isError && view.url != currentUrl) {
                            view.loadUrl(currentUrl)
                        }
                    }
                )

                // Error Overlay Screen
                if (isError) {
                    ErrorScreen(
                        message = errorMessage,
                        onRetry = {
                            isError = false
                            webView?.reload()
                        },
                        onOpenSettings = {
                            showSettingsState.value = true
                        }
                    )
                }

                // Premium Dark Glassmorphic Settings Dialog
                if (showSettings) {
                    SettingsDialog(
                        initialUrl = currentUrl,
                        onDismiss = { showSettingsState.value = false },
                        onSave = { newUrl ->
                            sharedPref.edit().putString(SIGNAGE_URL_PREFERENCE, newUrl).apply()
                            currentUrl = newUrl
                            isError = false
                            showSettingsState.value = false
                            webView?.loadUrl(newUrl)
                        }
                    )
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView(webView: WebView) {
        webView.setBackgroundColor(0) // Make background transparent to show Compose premium dark theme underneath
        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false // Auto-play videos
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_NO_CACHE
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
        }
        webView.scrollBarStyle = WebView.SCROLLBARS_OUTSIDE_OVERLAY
        webView.isScrollbarFadingEnabled = true
        
        // Disable long click inside webview
        webView.setOnLongClickListener { true }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        // TV remote 'Menu' or 'Back' key opens/closes settings dialog
        if (keyCode == KeyEvent.KEYCODE_MENU || keyCode == KeyEvent.KEYCODE_BACK) {
            showSettingsState.value = !showSettingsState.value
            return true
        }
        return super.onKeyDown(keyCode, event)
    }
}

@Composable
fun ErrorScreen(message: String, onRetry: () -> Unit, onOpenSettings: () -> Unit) {
    val retryFocusRequester = remember { FocusRequester() }
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xDD0D0D11)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier
                .width(450.dp)
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0x22FFFFFF))
                .border(1.dp, Brush.linearGradient(listOf(Color(0x33FFFFFF), Color(0x05FFFFFF))), RoundedCornerShape(24.dp))
                .padding(32.dp)
        ) {
            Text(
                text = "Connection Error",
                color = Color(0xFFEF5350),
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 12.dp)
            )
            
            Text(
                text = "Could not connect to the signage server. Check the device network and server status.\n\nError: $message",
                color = Color(0xFFE0E0E6),
                fontSize = 14.sp,
                lineHeight = 22.sp,
                modifier = Modifier.padding(bottom = 24.dp)
            )

            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                TvButton(
                    text = "Retry",
                    onClick = onRetry,
                    focusRequester = retryFocusRequester,
                    modifier = Modifier.weight(1f)
                )
                TvButton(
                    text = "Open Settings",
                    onClick = onOpenSettings,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
    
    LaunchedEffect(Unit) {
        retryFocusRequester.requestFocus()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsDialog(
    initialUrl: String,
    onDismiss: () -> Unit,
    onSave: (String) -> Unit
) {
    var urlText by remember { mutableStateOf(initialUrl) }
    var expandedDropdown by remember { mutableStateOf(false) }
    
    val saveFocusRequester = remember { FocusRequester() }
    val inputFocusRequester = remember { FocusRequester() }
    val dropdownFocusRequester = remember { FocusRequester() }

    val presetUrls = listOf(
        DEFAULT_SIGNAGE_URL,
        "http://10.144.158.96:3000",
        "http://192.168.1.100:3000",
        "http://192.168.0.100:3000",
        "http://localhost:3000",
        "https://chay-signage.netlify.app"
    )

    val configuration = LocalConfiguration.current
    val screenHeight = configuration.screenHeightDp.dp
    // Max dialog height is 85% of screen height to leave room and ensure it never gets cut off
    val maxDialogHeight = screenHeight * 0.85f

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 480.dp)
                .fillMaxWidth(0.9f)
                .heightIn(max = maxDialogHeight)
                .clip(RoundedCornerShape(20.dp))
                .background(Color(0xFF16161F))
                .border(1.dp, Brush.linearGradient(listOf(Color(0x33FFFFFF), Color(0x0AFFFFFF))), RoundedCornerShape(20.dp))
                .padding(16.dp)
        ) {
            // Main Column containing (1) Scrollable items and (2) Fixed bottom buttons
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                // 1. Scrollable Content Area (using weight to push buttons down and handle scroll)
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f, fill = false)
                        .verticalScroll(rememberScrollState())
                        .padding(bottom = 12.dp)
                ) {
                    // Header
                    Text(
                        text = "Signage TV Settings",
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 4.dp)
                    )

                    // Explanation
                    Text(
                        text = "Enter the signage web app URL. For a local Wi-Fi server, use the computer IP address.",
                        color = Color(0xFFA0A0AB),
                        fontSize = 12.sp,
                        lineHeight = 18.sp,
                        modifier = Modifier.padding(bottom = 4.dp)
                    )

                    // URL Input Field
                    OutlinedTextField(
                        value = urlText,
                        onValueChange = { urlText = it },
                        label = { Text("Signage Website URL", color = Color(0xFFA0A0AB)) },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFFBB86FC),
                            unfocusedBorderColor = Color(0x44FFFFFF),
                            focusedLabelColor = Color(0xFFBB86FC),
                            unfocusedLabelColor = Color(0xFFA0A0AB),
                            cursorColor = Color(0xFFBB86FC)
                        ),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Uri,
                            imeAction = ImeAction.Done
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .focusRequester(inputFocusRequester)
                    )

                    // Theme-consistent Dropdown Box
                    Box(modifier = Modifier.fillMaxWidth()) {
                        val interactionSource = remember { MutableInteractionSource() }
                        val isDropdownFocused by interactionSource.collectIsFocusedAsState()
                        
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(Color(0x11FFFFFF))
                                .border(
                                    1.dp,
                                    if (isDropdownFocused) Color(0xFFBB86FC) else Color(0x44FFFFFF),
                                    RoundedCornerShape(4.dp)
                                )
                                .focusRequester(dropdownFocusRequester)
                                .focusable(interactionSource = interactionSource)
                                .clickable { expandedDropdown = !expandedDropdown }
                                .padding(horizontal = 16.dp),
                            contentAlignment = Alignment.CenterStart
                        ) {
                            Row(
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = "Choose a preset URL...",
                                    color = Color(0xFFA0A0AB),
                                    fontSize = 14.sp
                                )
                                Text(
                                    text = if (expandedDropdown) "Close" else "Open",
                                    color = Color.White,
                                    fontSize = 12.sp
                                )
                            }
                        }

                        // HSL Dark Themed Dropdown Menu
                        DropdownMenu(
                            expanded = expandedDropdown,
                            onDismissRequest = { expandedDropdown = false },
                            modifier = Modifier
                                .width(396.dp) // Adjust width to fit nicely on mobile
                                .background(Color(0xFF1A1A24))
                                .border(1.dp, Color(0x22FFFFFF))
                        ) {
                            presetUrls.forEach { urlOption ->
                                DropdownMenuItem(
                                    text = { Text(urlOption, color = Color.White) },
                                    onClick = {
                                        urlText = urlOption
                                        expandedDropdown = false
                                    },
                                    modifier = Modifier.background(Color(0xFF1A1A24))
                                )
                            }
                        }
                    }
                }

                // 2. Fixed Actions Panel - docked at the bottom, never scrolled away or cut off
                Row(
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp)
                ) {
                    TvButton(
                        text = "Cancel",
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f)
                    )
                    TvButton(
                        text = "Save and Connect",
                        onClick = {
                            if (urlText.isNotBlank()) {
                                onSave(urlText)
                            }
                        },
                        focusRequester = saveFocusRequester,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        inputFocusRequester.requestFocus()
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
                    Brush.linearGradient(listOf(Color(0xFFBB86FC), Color(0xFF6200EE)))
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
