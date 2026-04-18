package app.bandhan.matrimony

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.view.KeyEvent
import android.webkit.*
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "Bandhan"
        // ↓ CHANGE THIS to your Vercel URL before building
        const val APP_URL = "https://YOUR-APP.vercel.app"
        const val APP_URL_DEBUG = "http://10.0.2.2:3000"
        const val PREFS = "BandhanPrefs"
        const val KEY_TOKEN = "session_token"
    }

    private var webView: WebView? = null
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var cameraUri: Uri? = null

    private val filePicker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val results: Array<Uri>? = when {
            result.resultCode != Activity.RESULT_OK -> null
            result.data?.clipData != null -> Array(result.data!!.clipData!!.itemCount) { result.data!!.clipData!!.getItemAt(it).uri }
            result.data?.data != null -> arrayOf(result.data!!.data!!)
            cameraUri != null -> arrayOf(cameraUri!!)
            else -> null
        }
        fileUploadCallback?.onReceiveValue(results)
        fileUploadCallback = null
        cameraUri = null
    }

    private val permLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { perms ->
        if (perms.values.all { it }) openFilePicker() else Toast.makeText(this, "Camera permission needed for photo upload", Toast.LENGTH_LONG).show()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        val layout = android.widget.FrameLayout(this)
        val wv = WebView(this)
        webView = wv

        // Progress bar
        val pb = android.widget.ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal)
        pb.layoutParams = android.widget.FrameLayout.LayoutParams(android.widget.FrameLayout.LayoutParams.MATCH_PARENT, 8)
        pb.max = 100

        layout.addView(wv, android.widget.FrameLayout.LayoutParams(android.widget.FrameLayout.LayoutParams.MATCH_PARENT, android.widget.FrameLayout.LayoutParams.MATCH_PARENT))
        layout.addView(pb)
        setContentView(layout)

        if (!isNetworkAvailable()) { showOffline(); return }

        setupWebView(wv, pb)
        handleDeepLink(intent)

        val url = if (BuildConfig.DEBUG) APP_URL_DEBUG else APP_URL
        wv.loadUrl(url)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView(wv: WebView, pb: android.widget.ProgressBar) {
        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(false)
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = "$userAgentString BandhanApp/1.0 Android/${Build.VERSION.RELEASE}"
        }

        wv.addJavascriptInterface(BandhanBridge(this), "BandhanAndroid")

        wv.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                pb.visibility = android.view.View.GONE
                // Restore saved token
                val token = getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_TOKEN, null)
                if (token != null) view?.evaluateJavascript("localStorage.setItem('bandhan_token','$token');", null)
                view?.evaluateJavascript("window.isAndroidApp=true;", null)
            }
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true && !isNetworkAvailable()) showOffline()
            }
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                return when {
                    url.startsWith("mailto:") -> { startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse(url))); true }
                    url.startsWith("tel:") -> { startActivity(Intent(Intent.ACTION_DIAL, Uri.parse(url))); true }
                    url.contains("bandhan.app") || url.contains("vercel.app") || url.contains("10.0.2.2") -> false
                    else -> { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))); true }
                }
            }
        }

        wv.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                pb.progress = newProgress
                pb.visibility = if (newProgress < 100) android.view.View.VISIBLE else android.view.View.GONE
            }
            override fun onShowFileChooser(wv: WebView?, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = callback
                requestFileAccess()
                return true
            }
            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }
            override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                Toast.makeText(this@MainActivity, message, Toast.LENGTH_SHORT).show()
                result?.confirm(); return true
            }
        }
    }

    private fun requestFileAccess() {
        val needed = mutableListOf<String>().apply {
            if (!hasPermission(Manifest.permission.CAMERA)) add(Manifest.permission.CAMERA)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (!hasPermission(Manifest.permission.READ_MEDIA_IMAGES)) add(Manifest.permission.READ_MEDIA_IMAGES)
            } else {
                if (!hasPermission(Manifest.permission.READ_EXTERNAL_STORAGE)) add(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
        }
        if (needed.isEmpty()) openFilePicker() else permLauncher.launch(needed.toTypedArray())
    }

    private fun openFilePicker() {
        val photoFile = File.createTempFile("BANDHAN_${SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())}_", ".jpg", getExternalFilesDir(Environment.DIRECTORY_PICTURES))
        cameraUri = FileProvider.getUriForFile(this, "$packageName.fileprovider", photoFile)

        val camera = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply { putExtra(MediaStore.EXTRA_OUTPUT, cameraUri) }
        val gallery = Intent(Intent.ACTION_GET_CONTENT).apply { type = "image/*" }
        filePicker.launch(Intent.createChooser(gallery, "Add Profile Photo").apply { putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(camera)) })
    }

    private fun hasPermission(p: String) = ContextCompat.checkSelfPermission(this, p) == PackageManager.PERMISSION_GRANTED

    private fun showOffline() {
        setContentView(android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            gravity = android.view.Gravity.CENTER
            setPadding(64, 64, 64, 64)
            setBackgroundColor(0xFF07060D.toInt())
            addView(android.widget.TextView(context).apply { text = "📡"; textSize = 56f; gravity = android.view.Gravity.CENTER; setTextColor(0xFFFFFFFF.toInt()) })
            addView(android.widget.TextView(context).apply { text = "No Internet"; textSize = 22f; gravity = android.view.Gravity.CENTER; setTextColor(0xFFFFFFFF.toInt()); setPadding(0, 24, 0, 12) })
            addView(android.widget.TextView(context).apply { text = "Please check your connection and try again."; textSize = 14f; gravity = android.view.Gravity.CENTER; setTextColor(0x88FFFFFF.toInt()) })
            addView(android.widget.Button(context).apply {
                text = "Retry"; setBackgroundColor(0xFFC8A96E.toInt()); setTextColor(0xFF1A1208.toInt())
                val lp = android.widget.LinearLayout.LayoutParams(android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 120)
                lp.topMargin = 48; layoutParams = lp
                setOnClickListener { if (isNetworkAvailable()) recreate() else Toast.makeText(context, "Still offline…", Toast.LENGTH_SHORT).show() }
            })
        })
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        return cm.getNetworkCapabilities(cm.activeNetwork)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    }

    override fun onNewIntent(intent: Intent?) { super.onNewIntent(intent); handleDeepLink(intent) }

    private fun handleDeepLink(intent: Intent?) {
        intent?.data?.let { uri ->
            val path = when (uri.scheme) {
                "bandhan" -> "/${uri.host}${uri.path ?: ""}"
                "https" -> uri.path ?: "/"
                else -> "/"
            }
            val url = "${if (BuildConfig.DEBUG) APP_URL_DEBUG else APP_URL}$path"
            webView?.post { webView?.loadUrl(url) }
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView?.canGoBack() == true) { webView?.goBack(); return true }
        return super.onKeyDown(keyCode, event)
    }

    override fun onResume() { super.onResume(); webView?.onResume() }
    override fun onPause() { super.onPause(); webView?.onPause() }
    override fun onDestroy() { webView?.destroy(); super.onDestroy() }
}

// ── JavaScript Bridge ──
class BandhanBridge(private val activity: MainActivity) {
    @JavascriptInterface fun isNativeApp(): Boolean = true
    @JavascriptInterface fun getDeviceInfo(): String = """{"platform":"android","version":"${Build.VERSION.RELEASE}","model":"${Build.MODEL}"}"""

    @JavascriptInterface fun saveToken(token: String) {
        activity.getSharedPreferences(MainActivity.PREFS, Activity.MODE_PRIVATE).edit().putString(MainActivity.KEY_TOKEN, token).apply()
    }
    @JavascriptInterface fun clearToken() {
        activity.getSharedPreferences(MainActivity.PREFS, Activity.MODE_PRIVATE).edit().remove(MainActivity.KEY_TOKEN).apply()
    }
    @JavascriptInterface fun getToken(): String =
        activity.getSharedPreferences(MainActivity.PREFS, Activity.MODE_PRIVATE).getString(MainActivity.KEY_TOKEN, "") ?: ""

    @JavascriptInterface fun showToast(msg: String) { activity.runOnUiThread { Toast.makeText(activity, msg, Toast.LENGTH_SHORT).show() } }

    @JavascriptInterface fun vibrate(ms: Long = 50) {
        val vib = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
            (activity.getSystemService(android.os.VibratorManager::class.java)).defaultVibrator
        else @Suppress("DEPRECATION") activity.getSystemService(android.os.Vibrator::class.java)
        vib?.vibrate(android.os.VibrationEffect.createOneShot(ms, android.os.VibrationEffect.DEFAULT_AMPLITUDE))
    }

    @JavascriptInterface fun shareProfile(name: String, url: String) {
        activity.runOnUiThread {
            activity.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, "Check out $name on Bandhan")
                putExtra(Intent.EXTRA_TEXT, "Found a great match for you on Bandhan! $url")
            }, "Share Profile"))
        }
    }
}
