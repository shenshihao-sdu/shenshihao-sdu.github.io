// static/js/scripts.js

const content_dir = "contents/";
const config_file = "config.yml";
const section_names = ["home", "publications", "patents"];

// 让重活在浏览器空闲时执行，降低 Total Blocking Time
function idle(timeout = 1200) {
  return new Promise((resolve) => {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => resolve(), { timeout });
    } else {
      // Safari/旧浏览器降级
      setTimeout(resolve, 0);
    }
  });
}

function setHTMLById(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function setTextById(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// 只在 MathJax 存在时调用，并尽量只 typeset 一次
async function typesetMath() {
  try {
    if (!window.MathJax) return;
    if (typeof MathJax.typesetPromise === "function") {
      await MathJax.typesetPromise();
    } else if (typeof MathJax.typeset === "function") {
      MathJax.typeset();
    }
  } catch (e) {
    console.log(e);
  }
}

async function loadYamlConfig() {
  try {
    const resp = await fetch(content_dir + config_file, { cache: "force-cache" });
    const text = await resp.text();
    const yml = jsyaml.load(text);

    Object.keys(yml || {}).forEach((key) => {
      const v = yml[key];
      // config 里多数是纯文本，优先 textContent；确实需要 HTML 再改回 innerHTML
      setTextById(key, String(v));
    });
  } catch (e) {
    console.log(e);
  }
}

async function loadSections() {
  // marked 配置
  marked.use({ mangle: false, headerIds: false });

  // 先并行把 markdown 都拉下来（网络阶段不占用主线程太多）
  const tasks = section_names.map(async (name) => {
    const resp = await fetch(content_dir + name + ".md", { cache: "force-cache" });
    const markdown = await resp.text();
    return { name, markdown };
  });

  let results = [];
  try {
    results = await Promise.all(tasks);
  } catch (e) {
    console.log(e);
    return;
  }

  // 再分批在空闲时解析 + 注入（降低阻塞）
  for (const { name, markdown } of results) {
    await idle(1200);
    const html = marked.parse(markdown);
    setHTMLById(name + "-md", html);
  }

  // 全部注入完成后，再统一 typeset 一次
  await idle(1200);
  await typesetMath();
}

window.addEventListener("DOMContentLoaded", () => {
  // Bootstrap scrollspy
  const mainNav = document.body.querySelector("#mainNav");
  if (mainNav) {
    new bootstrap.ScrollSpy(document.body, { target: "#mainNav", offset: 74 });
  }

  // Collapse responsive navbar
  const navbarToggler = document.body.querySelector(".navbar-toggler");
  const responsiveNavItems = [].slice.call(
    document.querySelectorAll("#navbarResponsive .nav-link")
  );
  responsiveNavItems.forEach((item) => {
    item.addEventListener("click", () => {
      if (navbarToggler && window.getComputedStyle(navbarToggler).display !== "none") {
        navbarToggler.click();
      }
    });
  });

  // 并行启动
  loadYamlConfig();
  loadSections();
});