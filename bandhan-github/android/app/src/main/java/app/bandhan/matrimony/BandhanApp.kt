package app.bandhan.matrimony

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class BandhanApp : Application() {
    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)
            listOf(
                Triple("bandhan_main",  "Bandhan Notifications", NotificationManager.IMPORTANCE_HIGH),
                Triple("bandhan_chat",  "New Messages",          NotificationManager.IMPORTANCE_HIGH),
                Triple("bandhan_match", "New Interests",         NotificationManager.IMPORTANCE_DEFAULT),
            ).forEach { (id, name, imp) -> nm.createNotificationChannel(NotificationChannel(id, name, imp)) }
        }
    }
}
