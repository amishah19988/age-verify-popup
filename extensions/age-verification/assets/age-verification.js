document.addEventListener("DOMContentLoaded", function () {
  const shop = window.ageVerificationShop;

  if (!shop) {
    return;
  }

  const modal = document.getElementById("age-verification-modal");
  const container = document.getElementById("age-verification-container");

  if (container) {
    container.style.display = "none";
  }

  if (modal) {
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.zIndex = "9999";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";
    modal.style.display = "none";
  }

  const ageVerified = localStorage.getItem("age_verified");
  const ageVerifiedTimestamp = localStorage.getItem("age_verified_timestamp");

  fetch(`/apps/fetch/age-verification-settings?shop=${encodeURIComponent(shop)}`)
    .then((res) => {
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    })
    .then((settings) => {
      if (settings.error) {
        return;
      }

      const cookieLifetime = settings.cookieLifetime || 30;
      const expirationDate = ageVerifiedTimestamp ? new Date(parseInt(ageVerifiedTimestamp)) : null;
      const currentDate = new Date();
      const isCookieValid = expirationDate && currentDate < expirationDate;

      if (ageVerified === "true" && isCookieValid) {
        if (modal) {
          modal.style.display = "none";
          modal.style.backgroundColor = "transparent";
          modal.style.backdropFilter = "none";
          modal.style.webkitBackdropFilter = "none";
          modal.style.opacity = "0";
          document.body.style.overflow = "auto";
        }
        return;
      }

      if (settings.status === "enable") {
        fetch(`/apps/fetch/age-verification-rules?shop=${encodeURIComponent(shop)}`)
          .then((res) => {
            if (!res.ok) throw new Error("Failed to fetch rules");
            return res.json();
          })
          .then((rules) => {
            if (rules.error) {
              return;
            }
            const currentUrl = window.location.href.toLowerCase();

            let pageUrls = [];
            if (typeof rules.pageUrls === 'string') {
              pageUrls = rules.pageUrls
                .split(/[\n, ]+/)
                .map(url => url.trim())
                .filter(url => url.length > 0);
            } else if (Array.isArray(rules.pageUrls)) {
              pageUrls = rules.pageUrls;
            }

            const normalizedPageUrls = pageUrls.map(url => {
              let normalized = url.toLowerCase();
              normalized = normalized.replace(/^https?:\/\//, '');
              normalized = normalized.replace(/\/$/, '');
              return normalized;
            });

            let normalizedCurrentUrl = currentUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
            normalizedCurrentUrl = normalizedCurrentUrl.split('?')[0].split('#')[0];

            const shouldShowPopup = rules.visibility === 'all' ||
              (rules.visibility === 'specific' &&
                normalizedPageUrls.some(url => {
                  return normalizedCurrentUrl === url;
                }));

            if (shouldShowPopup) {
              showAgeVerificationPopup(settings, cookieLifetime);
            }
          })
          .catch((err) => console.error("Rules fetch error:", err));
      }
    })
    .catch((err) => console.error("Age verification settings fetch error:", err));
});

function showAgeVerificationPopup(settings, cookieLifetime) {
  const modal = document.getElementById("age-verification-modal");
  const content = document.getElementById("age-verification-content");

  modal.style.display = "flex";
  modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  modal.style.backdropFilter = "blur(8px)";
  modal.style.webkitBackdropFilter = "blur(8px)";
  modal.style.transition = "opacity 0.3s ease";
  modal.style.opacity = "1";

  content.style.backgroundColor = settings.bodyBackgroundColor;
  content.style.position = "relative";
  content.style.padding = "20px";
  content.style.maxWidth = "500px";
  content.style.textAlign = "center";

  const header = document.createElement("div");
  header.style.backgroundColor = settings.headerBackgroundColor;
  header.style.padding = "15px";
  header.style.marginBottom = "20px";

  const title = document.createElement("h2");
  title.textContent = settings.popupTitle;
  title.style.color = settings.textColor;
  title.style.margin = "0";
  title.style.fontSize = "24px";
  title.style.fontWeight = "bold";
  header.appendChild(title);

  const iconContainer = document.createElement("div");
  iconContainer.style.margin = "20px auto";
  iconContainer.style.display = "flex";
  iconContainer.style.justifyContent = "center";

  if (settings.iconImage) {
    const icon = document.createElement("img");
    icon.src = settings.iconImage;
    icon.alt = "Age Verification Icon";
    icon.style.width = "80px";
    icon.style.height = "80px";
    icon.style.borderRadius = "50%";
    iconContainer.appendChild(icon);
  }

  const contentTitleElement = document.createElement("h3");
  contentTitleElement.textContent = settings.contentTitle || '';
  contentTitleElement.style.color = settings.contentTitleColor || '#ffffff';
  contentTitleElement.style.margin = "10px 0";
  contentTitleElement.style.fontSize = "25px";
  contentTitleElement.style.textAlign = "center";

  const contentSubtitleElement = document.createElement("p");
  contentSubtitleElement.textContent = settings.contentSubtitle || '';
  contentSubtitleElement.style.color = settings.contentSubtitleColor || '#ffffff';
  contentSubtitleElement.style.fontSize = "16px";
  contentSubtitleElement.style.margin = "20px 0";
  contentSubtitleElement.style.textAlign = "center";

  let verificationElement = document.createElement("div");

  if (settings.verificationType === "checkbox") {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "age-verification-checkbox";
    checkbox.style.marginRight = "10px";

    const label = document.createElement("label");
    label.htmlFor = "age-verification-checkbox";
    label.style.color = settings.textColor;
    label.innerHTML = `${settings.linkTitle} <a href="${settings.anchorUrl}" style="color: ${settings.textColor}; text-decoration: underline;" target="_blank">${settings.anchorText}</a>`;

    verificationElement.appendChild(checkbox);
    verificationElement.appendChild(label);
  } else if (settings.verificationType === "yesno") {

  } else if (settings.verificationType === "dateofbirth") {
    const dateContainer = document.createElement("div");
    dateContainer.style.display = "flex";
    dateContainer.style.justifyContent = "center";
    dateContainer.style.gap = "10px";
    dateContainer.style.marginBottom = "20px";

    const daySelect = document.createElement("select");
    daySelect.name = "day";
    for (let i = 1; i <= 31; i++) {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = i;
      daySelect.appendChild(option);
    }

    const monthSelect = document.createElement("select");
    monthSelect.name = "month";
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    months.forEach((month, index) => {
      const option = document.createElement("option");
      option.value = index + 1;
      option.textContent = month;
      monthSelect.appendChild(option);
    });

    const yearSelect = document.createElement("select");
    yearSelect.name = "year";
    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i >= currentYear - 100; i--) {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = i;
      yearSelect.appendChild(option);
    }

    const enterButton = document.createElement("button");
    enterButton.textContent = "Enter";
    enterButton.style.backgroundColor = settings.buttonLeftBackgroundColor || '#420642';
    enterButton.style.color = settings.buttonLeftTextColor || '#ffffff';
    enterButton.style.border = "none";
    enterButton.style.padding = "10px 30px";
    enterButton.style.cursor = "pointer";
    enterButton.style.borderRadius = "5px";
    enterButton.style.zIndex = "10";

    enterButton.onclick = function () {
      const day = parseInt(daySelect.value);
      const month = parseInt(monthSelect.value) - 1;
      const year = parseInt(yearSelect.value);
      const birthDate = new Date(year, month, day);
      const age = calculateAge(birthDate);

      if (age >= parseInt(settings.ageLimit)) {
        setAgeVerificationCookie(cookieLifetime);
        modal.style.display = "none";
        modal.style.backgroundColor = "transparent";
        modal.style.backdropFilter = "none";
        modal.style.webkitBackdropFilter = "none";
        modal.style.opacity = "0";
        document.body.style.overflow = "auto";
      } else {
        if (settings.underAgeNoticeType === "show_message" && settings.underAgeMessage) {
          const message = document.createElement("p");
          message.textContent = settings.underAgeMessage;
          message.style.color = "red";
          message.style.fontSize = "16px";
          message.style.textAlign = "center";
          message.style.padding = "20px";
          message.style.backgroundColor = settings.bodyBackgroundColor;
          message.style.margin = "20px 0";
          content.appendChild(message);
          dateContainer.style.display = "none";
          enterButton.style.display = "none";
          modal.style.display = "flex";
          document.body.style.overflow = "hidden";
        } else if (settings.underAgeNoticeType === "redirect_url" && settings.redirectUrl) {
          window.location.href = settings.redirectUrl;
        }
      }
    };

    dateContainer.appendChild(daySelect);
    dateContainer.appendChild(monthSelect);
    dateContainer.appendChild(yearSelect);
    dateContainer.appendChild(enterButton);
    verificationElement.appendChild(dateContainer);
  }

  if (settings.verificationType !== "dateofbirth") {
    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "center";
    buttonContainer.style.gap = "20px";
    buttonContainer.style.marginTop = "20px";

    const agreeButton = document.createElement("button");
    agreeButton.textContent = settings.buttonLabelLeft;
    agreeButton.style.backgroundColor = settings.buttonLeftBackgroundColor || '#420642';
    agreeButton.style.color = settings.buttonLeftTextColor || '#ffffff';
    agreeButton.style.border = "none";
    agreeButton.style.padding = "10px 30px";
    agreeButton.style.cursor = "pointer";
    agreeButton.style.borderRadius = "5px";
    agreeButton.style.fontSize = "15px";
    agreeButton.style.zIndex = "10";

    agreeButton.onclick = function () {
      if (settings.verificationType === "checkbox" && !document.getElementById("age-verification-checkbox").checked) {
        alert(`Please confirm you are at least ${settings.ageLimit} years old.`);
        return;
      }
      setAgeVerificationCookie(cookieLifetime);
      modal.style.display = "none";
      modal.style.backgroundColor = "transparent";
      modal.style.backdropFilter = "none";
      modal.style.webkitBackdropFilter = "none";
      modal.style.opacity = "0";
      document.body.style.overflow = "auto";
    };

    const disagreeButton = document.createElement("button");
    disagreeButton.textContent = settings.buttonLabelRight;
    disagreeButton.style.backgroundColor = settings.buttonRightBackgroundColor || '#420642';
    disagreeButton.style.color = settings.buttonRightTextColor || '#ffffff';
    disagreeButton.style.border = "none";
    disagreeButton.style.padding = "10px 30px";
    disagreeButton.style.cursor = "pointer";
    disagreeButton.style.borderRadius = "5px";
    disagreeButton.style.fontSize = "15px";
    disagreeButton.style.zIndex = "10";

    disagreeButton.onclick = function () {
      if (settings.underAgeNoticeType === "show_message" && settings.underAgeMessage) {
        const message = document.createElement("p");
        message.textContent = settings.underAgeMessage;
        message.style.color = "red";
        message.style.fontSize = "16px";
        message.style.textAlign = "center";
        message.style.padding = "20px";
        message.style.backgroundColor = settings.bodyBackgroundColor;
        message.style.margin = "20px 0";
        content.appendChild(message);
        verificationElement.style.display = "none";
        buttonContainer.style.display = "none";
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";
      } else if (settings.underAgeNoticeType === "redirect_url" && settings.redirectUrl) {
        window.location.href = settings.redirectUrl;
      }
    };

    buttonContainer.appendChild(agreeButton);
    buttonContainer.appendChild(disagreeButton);
    verificationElement.appendChild(buttonContainer);
  }

  content.innerHTML = "";
  content.appendChild(header);
  content.appendChild(iconContainer);
  content.appendChild(contentTitleElement);
  contentSubtitleElement.style.marginBottom = "30px";
  content.appendChild(contentSubtitleElement);
  content.appendChild(verificationElement);

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function setAgeVerificationCookie(days) {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + days);
  localStorage.setItem("age_verified", "true");
  localStorage.setItem("age_verified_timestamp", expirationDate.getTime().toString());
}

function calculateAge(birthDate) {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}