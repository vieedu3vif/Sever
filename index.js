import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch"; // Import fetch module
import admin from "firebase-admin"; // Import Firebase Admin SDK
import firebaseKey from "./healthst-64a0d-firebase-adminsdk-zxccr-ef37ea3ad0.json" assert { type: "json" }; // Firebase key

// Tạo server Express
const app = express();
app.use(bodyParser.json());

const currentTime = new Date();
const twel = new Date(currentTime.getTime() - 3 * 60 * 1000); // 1 giờ trước

const startTimestamp = twel.getTime();
const endTimestamp = currentTime.getTime();

// Cấu hình ThingsBoard
const THINGSBOARD_HOST = "demo.thingsboard.io";
const deviceIds = [
  "c7826090-9c28-11ef-b5a8-ed1aed9a651f",
  "f009edb0-9cde-11ef-b5a8-ed1aed9a651f",
]; // Thay bằng ID thiết bị của bạn
const JWT_TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJkdWNtaW5ocGhvY29AZ21haWwuY29tIiwidXNlcklkIjoiMDgyOTQxNzAtOWMyMS0xMWVmLWI1YTgtZWQxYWVkOWE2NTFmIiwic2NvcGVzIjpbIlRFTkFOVF9BRE1JTiJdLCJzZXNzaW9uSWQiOiIxMTllZmE2OS1hYmJiLTRmYzMtODYyYi00ZjExMGRkMzIwZTEiLCJleHAiOjE3MzI2ODUxMzksImlzcyI6InRoaW5nc2JvYXJkLmlvIiwiaWF0IjoxNzMwODg1MTM5LCJmaXJzdE5hbWUiOiJuZ3V5ZW4iLCJsYXN0TmFtZSI6ImR1YyBtaW5oIiwiZW5hYmxlZCI6dHJ1ZSwicHJpdmFjeVBvbGljeUFjY2VwdGVkIjp0cnVlLCJpc1B1YmxpYyI6ZmFsc2UsInRlbmFudElkIjoiMDZhYzY1NzAtOWMyMS0xMWVmLWI1YTgtZWQxYWVkOWE2NTFmIiwiY3VzdG9tZXJJZCI6IjEzODE0MDAwLTFkZDItMTFiMi04MDgwLTgwODA4MDgwODA4MCJ9.eE7i2EN-fXGgRgytAru8yWiFTXWfMlRAyhR2KdRUnl2W2-WmOhswSDha9J-NX66Zxi5Gv0CmbZ5xMkG1JC3IIg"; // Thay bằng JWT Token của bạn

// Cấu hình Firebase
admin.initializeApp({
  credential: admin.credential.cert(firebaseKey),
});

// Hàm lấy dữ liệu telemetry từ ThingsBoard
async function fetchTelemetryData(deviceId) {
  try {
    const response = await fetch(
      `http://${THINGSBOARD_HOST}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=heart_rate,temperature,spo2&startTs=${startTimestamp}&endTs=${endTimestamp}&interval=60000&limit=100&agg=AVG`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${JWT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      console.error(`Failed to fetch telemetry data for device ${deviceId}`);
    }
  } catch (error) {
    console.error(`Error fetching telemetry data for device ${deviceId}:`, error);
  }
  return null;
}

// Hàm kiểm tra dữ liệu và gửi thông báo nếu cần
async function checkAndNotify() {
  for (const deviceId of deviceIds) {
    const data = await fetchTelemetryData(deviceId);

    if (data) {
      console.log(`Telemetry data for device ${deviceId}:`, data);

      // Kiểm tra dữ liệu (ví dụ: nhiệt độ vượt ngưỡng)
      if (data.temperature && data.temperature[0]?.value > 30) {
        sendNotification(
          "Bệnh nhân bất thường",
          `Nhiệt độ: ${data.temperature[0].value}°C, vượt ngưỡng!`
        );
      } else if (
        data.heart_rate &&
        (data.heart_rate[0]?.value > 130 || data.heart_rate[0]?.value < 60)
      ) {
        sendNotification(
          "Bệnh nhân bất thường",
          `Nhịp tim: ${data.heart_rate[0].value} bpm, không bình thường!`
        );
      } else if (data.spo2 && data.spo2[0]?.value < 95) {
        sendNotification(
          "Chỉ số SpO2 bất thường",
          `SpO2: ${data.spo2[0].value}%, quá thấp!`
        );
      }
    }
  }
}

// Hàm gửi thông báo qua Firebase
function sendNotification(title, body) {
  const message = {
    notification: {
      title,
      body,
    },
    topic: "alerts", // Topic mà ứng dụng Android đăng ký
  };

  admin
    .messaging()
    .send(message)
    .then((response) => {
      console.log("Notification sent successfully:", response);
    })
    .catch((error) => {
      console.error("Error sending notification:", error.message);
    });
}

// Thiết lập một endpoint HTTP để kiểm tra thủ công
app.get("/check-telemetry", async (req, res) => {
  try {
    await checkAndNotify();
    res
      .status(200)
      .send("Telemetry checked and notifications sent if needed.");
  } catch (error) {
    console.error("Error in /check-telemetry:", error);
    res.status(500).send("An error occurred.");
  }
});

// Lặp lại kiểm tra tự động mỗi phút
setInterval(checkAndNotify, 60 * 1000);

// Server chạy tại port 3000
app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
