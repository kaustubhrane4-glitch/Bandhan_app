package app.bandhan.matrimony.services

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.media.RingtoneManager
import androidx.core.app.NotificationCompat
import app.bandhan.matrimony.MainActivity
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class BandhanFirebaseService : FirebaseMessagingService() {
    override fun onNewToken(token: String) { /* Send to backend: api.updateFCMToken(token) */ }

    override fun onMessageReceived(msg: RemoteMessage) {
        val title   = msg.notification?.title ?: msg.data["title"] ?: "Bandhan"
        val body    = msg.notification?.body  ?: msg.data["body"]  ?: ""
        val channel = when (msg.data["type"]) { "message" -> "bandhan_chat"; "interest" -> "bandhan_match"; else -> "bandhan_main" }
        val deep    = msg.data["deep_link"] ?: ""

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            if (deep.isNotEmpty()) data = android.net.Uri.parse(deep)
        }
        val pi = PendingIntent.getActivity(this, System.currentTimeMillis().toInt(), intent, PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE)

        val notification = NotificationCompat.Builder(this, channel)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title).setContentText(body)
            .setAutoCancel(true).setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
            .setPriority(NotificationCompat.PRIORITY_HIGH).setContentIntent(pi).build()

        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .notify(System.currentTimeMillis().toInt(), notification)
    }
}
