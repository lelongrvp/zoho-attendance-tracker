document.addEventListener("DOMContentLoaded", function () {
  const checkinTimeElem = document.getElementById("checkin-time");
  const checkout1TimeElem = document.getElementById("checkout1-time");
  const checkout1StatusElem = document.getElementById("checkout1-status");
  const fulltimeTimeElem = document.getElementById("fulltime-time");
  const fulltimeStatusElem = document.getElementById("fulltime-status");
  const refreshBtn = document.getElementById("refreshBtn");
  const loginAlertElem = document.getElementById("login-alert");

  let checkout1AlertShown = false;
  let fulltimeAlertShown = false;

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function getRemainingTime(targetTime) {
    const now = new Date();
    const diffMs = targetTime - now;

    if (diffMs <= 0) {
      return { text: "Time completed", className: "time-green" };
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return { text: `${hours} hours ${minutes} minutes`, className: "time-red" };
  }

  function showChromeAlert(message) {
    alert(message); // Display alert in Chrome
  }

  function updateAttendanceDisplay() {
    chrome.storage.local.get("csrfToken", function (data) {
      if (!data.csrfToken) {
        // Hiển thị cảnh báo nếu không có CSRF token
        loginAlertElem.style.display = "block";
      } else {
        loginAlertElem.style.display = "none";
      }
    });
    chrome.storage.local.get("attendanceData", function (data) {
      if (data.attendanceData) {
        const today = new Date().toISOString().split("T")[0];

        // Tính toán số ngày không đủ 8 tiếng và không chấm công

        if (data.attendanceData && data.attendanceData.dayList) {
          console.log(data.attendanceData);
          let dayList = data.attendanceData.dayList;

          let fulltimeThreshold = 8 * 3600; // 8 tiếng tính bằng giây
          let daysBelow8Hours = []; // Lưu danh sách số giờ
          let daysNoAttendance = 0; // Số ngày absent
          let absentCount = 0;

          // Xác định khoảng thời gian chu kỳ: 21 tháng trước -> 20 tháng này
          let today = new Date();
          let startCycle, endCycle;

          if (today.getDate() >= 21) {
            // Nếu hôm nay >= 21 thì chu kỳ là 21 tháng này -> 20 tháng sau
            startCycle = new Date(today.getFullYear(), today.getMonth(), 21);
            endCycle = new Date(today.getFullYear(), today.getMonth() + 1, 21);
          } else {
            // Nếu hôm nay < 21 thì chu kỳ là 21 tháng trước -> 20 tháng này
            startCycle = new Date(
              today.getFullYear(),
              today.getMonth() - 1,
              21
            );
            endCycle = new Date(today.getFullYear(), today.getMonth(), 21);
          }

          let leaveUsed = 0; // Counter for used leave days
          let daysBelow6Hours = []; // For days < 6 hours
          let days6To8Hours = []; // For days between 6-8 hours

          Object.values(dayList).forEach((day) => {
            let dayDate = new Date(day.orgdate);
            let tsecs = day.tsecs || 0;
            let status = (day.status || "").trim();

            if (dayDate >= startCycle && dayDate <= endCycle) {
              let hoursWorked = (tsecs / 3600).toFixed(1);
              console.log(dayDate);

              if (tsecs > 0) {
                if (tsecs < 6 * 3600) {
                  // Less than 6 hours
                  daysBelow6Hours.push(hoursWorked);
                } else if (tsecs < fulltimeThreshold) {
                  // Between 6-8 hours
                  days6To8Hours.push(hoursWorked);
                }
              }

              if (day.description && day.description !== "") {
                daysNoAttendance++;
              }
              if (day.leaveDaysTaken) {
                leaveUsed += day.leaveDaysTaken;
              }
              if (status === "Absent") {
                absentCount++;
              }
            }
          });

          const text6To8Hours =
            days6To8Hours.length > 0
              ? `[${days6To8Hours.length}/5] --- [${days6To8Hours.join(", ")}]`
              : "0";

          const textBelow6Hours =
            daysBelow6Hours.length > 0
              ? `[${daysBelow6Hours.length}] --- [${daysBelow6Hours.join(
                  ", "
                )}]`
              : "0";

          document.getElementById("below-8-hours-count").textContent =
            text6To8Hours;
          document.getElementById("below-6-hours-count").textContent =
            textBelow6Hours;
          document.getElementById(
            "no-attendance-count"
          ).textContent = `${daysNoAttendance}/3`;
          document.getElementById("leave-used").textContent = `${leaveUsed}`;
          document.getElementById("absent-count").textContent = absentCount;
        } else {
          document.getElementById("below-8-hours-count").textContent = "N/A";
          document.getElementById("below-6-hours-count").textContent = "N/A";
          document.getElementById("no-attendance-count").textContent = "N/A";
          document.getElementById("leave-used").textContent = "N/A";
          document.getElementById("absent-count").textContent = "N/A";
        }

        // Hiển thị thông tin chấm công
        if (data.attendanceData.entries) {
          const todayEntries = data.attendanceData.entries[today];
          if (todayEntries && todayEntries.length > 0) {
            const checkinTime = todayEntries[0].fdate;
            const checkinDate = new Date(checkinTime.replace(/-/g, "/"));

            // Calculate Checkout 1 time (7.25h after check-in)
            const checkout1Date = new Date(
              checkinDate.getTime() + 7.25 * 60 * 60 * 1000
            );

            // Calculate Fulltime time (9.25h after check-in)
            const fulltimeDate = new Date(
              checkinDate.getTime() + 9.25 * 60 * 60 * 1000
            );

            // Display times
            checkinTimeElem.textContent = formatTime(checkinDate);
            checkout1TimeElem.textContent = formatTime(checkout1Date);
            fulltimeTimeElem.textContent = formatTime(fulltimeDate);

            // Update Checkout 1 status
            const checkout1Status = getRemainingTime(checkout1Date);
            checkout1StatusElem.textContent = checkout1Status.text;
            checkout1StatusElem.className = checkout1Status.className;

            // Update Fulltime status
            const fulltimeStatus = getRemainingTime(fulltimeDate);
            fulltimeStatusElem.textContent = fulltimeStatus.text;
            fulltimeStatusElem.className = fulltimeStatus.className;

            // Check if Checkout 1 time is reached and alert not shown
            if (!checkout1AlertShown && new Date() >= checkout1Date) {
              //showChromeAlert("🎉 You have reached Checkout 1 time! Take a short break.");
              checkout1AlertShown = true;
            }

            // Check if Fulltime is reached and alert not shown
            if (!fulltimeAlertShown && new Date() >= fulltimeDate) {
              //showChromeAlert("✅ You have completed your Fulltime work hours! Congratulations! 🎉");
              fulltimeAlertShown = true;
            }

            // Change color if Checkout 1 or Fulltime is after 19:30
            const thresholdTime = new Date();
            thresholdTime.setHours(19, 30, 0, 0);
            if (
              checkout1Date >= thresholdTime ||
              fulltimeDate >= thresholdTime
            ) {
              checkout1StatusElem.className = "time-orange";
              fulltimeStatusElem.className = "time-orange";
            }
          } else {
            checkinTimeElem.textContent = "No attendance record";
            checkout1TimeElem.textContent = "N/A";
            fulltimeTimeElem.textContent = "N/A";
          }
        }
      } else {
        checkinTimeElem.textContent = "No data found";
        checkout1TimeElem.textContent = "N/A";
        fulltimeTimeElem.textContent = "N/A";
      }
    });
  }

  // Load data when popup opens
  updateAttendanceDisplay();

  // Refresh data on button click
  refreshBtn.addEventListener("click", function () {
    checkinTimeElem.textContent = "Refreshing...";
    checkout1TimeElem.textContent = "Refreshing...";
    fulltimeTimeElem.textContent = "Refreshing...";

    chrome.runtime.sendMessage(
      { action: "updateAttendance" },
      function (response) {
        if (response && response.status === "success") {
          updateAttendanceDisplay();
        } else {
          checkinTimeElem.textContent = "Failed to refresh";
        }
      }
    );
  });
});
