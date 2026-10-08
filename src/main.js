// 시안 v3 스크립트: 전후 비교 슬라이더, 상담 신청 링크, 견적 폼(시안), 스크롤 등장

// 비워 두면 '상담 신청' 버튼은 페이지 아래 견적 폼으로 이동합니다.
// 카카오톡 채널은 쓰지 않기로 했습니다(2026-10-08). 상담은 전화와 견적 폼으로만 받습니다.
const KAKAO_URL = "";

// 1) 전후 비교 슬라이더
document.querySelectorAll("[data-compare]").forEach((box) => {
  const range = box.querySelector(".compare__range");
  const set = (v) => box.style.setProperty("--pos", v + "%");
  range.addEventListener("input", () => set(range.value));
  set(range.value);
});

// 2) 상담 신청 버튼
document.querySelectorAll("[data-kakao]").forEach((a) => {
  if (KAKAO_URL) {
    a.href = KAKAO_URL;
    a.target = "_blank";
    a.rel = "noopener";
  } else {
    a.href = "#contact";
  }
});

// 3) 스크롤 등장: 화면에 들어오면 한 번만
const reveals = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -10% 0px" });
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add("is-in"));
}
