async function fetchZohoAttendance() {
  // Kiểm tra token trong Chrome Storage trước
  const storageData = await chrome.storage.local.get("csrfToken");
  let csrfToken = storageData.csrfToken;

  // Nếu không có token, yêu cầu người dùng đăng nhập Zoho
  if (!csrfToken) {
    console.warn("CSRF token not found. Please log in to Zoho People.");
    return;
  }

  const url =
    "https://people.zoho.com/hrportal1524046581683/AttendanceViewAction.zp";
  const requestBody = new URLSearchParams({
    mode: "getAttList",
    conreqcsr: csrfToken,
    loadToday: "false",
    view: "month",
    preMonth: "0",
  });

  const requestBody2 = new URLSearchParams({
    mode: "getAttList",
    conreqcsr: csrfToken,
    loadToday: "false",
    view: "month",
    preMonth: "1",
  });

  const headers = {
    Accept: "*/*",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    Cookie: "people_v5=enabled; _your_other_cookies_here_",
  };
  const headers2 = {
    Accept: "*/*",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    Cookie: "people_v5=enabled; _your_other_cookies_here_",
  };
  try {
    const response1 = await fetch(url, {
      method: "POST",
      headers: headers,
      body: requestBody,
    });
    const response2 = await fetch(url, {
      method: "POST",
      headers: headers2,
      body: requestBody2,
    });

    if (!response1.ok) {
      throw new Error(`HTTP error! Status: ${response1.status}`);
    }
    if (!response2.ok) {
      throw new Error(`HTTP error! Status: ${response2.status}`);
    }
    const dataThisMonth = await response1.json();
    const dataLastMonth = await response2.json();

    // Gộp dayList và đánh lại key từ 1 đến hết
    const combinedDayList = {};

    // Lấy dữ liệu từ tháng trước
    const lastMonthDays = Object.values(dataLastMonth.dayList);

    // Lấy dữ liệu từ tháng này
    const thisMonthDays = Object.values(dataThisMonth.dayList);

    // Kết hợp tất cả ngày từ tháng trước và tháng này
    const allDays = [...lastMonthDays, ...thisMonthDays];

    // Đánh lại key từ 1 đến hết
    allDays.forEach((day, index) => {
      combinedDayList[index] = day;
    });

    // Sau khi gộp và đánh lại key, bạn có thể gộp toàn bộ dữ liệu
    const data = {
      ...dataThisMonth, // Giữ lại tất cả các trường từ tháng này
      dayList: combinedDayList, // Gộp dayList từ tháng trước và tháng này
      entries: {
        ...dataLastMonth.entries, // Gộp entries từ tháng trước
        ...dataThisMonth.entries, // Gộp entries từ tháng này
      },
    };

    console.log("Combined data with new dayList:", data);
    chrome.storage.local.set({ attendanceData: data });
  } catch (error) {
    console.error("Error fetching Zoho attendance:", error);
  }
}

// Chạy tự động khi extension được khởi động
chrome.runtime.onInstalled.addListener(() => {
  fetchZohoAttendance();
});

// Lấy token từ Cookie Zoho
async function fetchZohoCSRFToken() {
  try {
    const cookies = await chrome.cookies.getAll({ domain: "people.zoho.com" });
    const csrfCookie = cookies.find((cookie) => cookie.name === "CSRF_TOKEN");

    if (csrfCookie) {
      const csrfToken = csrfCookie.value;
      console.log("🔑 CSRF Token Retrieved:", csrfToken);
      await chrome.storage.local.set({ csrfToken: csrfToken });
      return csrfToken;
    } else {
      console.warn("⚠️ CSRF Token not found. Please log in to Zoho.");
      return null;
    }
  } catch (error) {
    console.error("❌ Error retrieving CSRF token:", error);
    return null;
  }
}

// Chạy tự động khi extension được khởi động
chrome.runtime.onInstalled.addListener(async () => {
  console.log("🔄 Extension Installed. Fetching CSRF Token...");
  await fetchZohoCSRFToken();
  await fetchZohoAttendance();
});

// Khi user mở trình duyệt hoặc chuyển tab, kiểm tra lại token
chrome.tabs.onActivated.addListener(async () => {
  await fetchZohoCSRFToken();
});

// Khi user đăng nhập vào Zoho, cập nhật token mới
chrome.cookies.onChanged.addListener(async (changeInfo) => {
  if (
    changeInfo.cookie.domain.includes("people.zoho.com") &&
    changeInfo.cookie.name === "CSRF_TOKEN"
  ) {
    console.log("🔄 CSRF Token Updated:", changeInfo.cookie.value);
    await chrome.storage.local.set({ csrfToken: changeInfo.cookie.value });
  }
});

// Cho phép popup gọi API cập nhật dữ liệu
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateAttendance") {
    fetchZohoCSRFToken(); // Cập nhật token trước khi gọi API
    fetchZohoAttendance()
      .then(() => {
        sendResponse({ status: "success" });
      })
      .catch((error) => {
        sendResponse({ status: "error", message: error.message });
      });
  }
  return true;
});
