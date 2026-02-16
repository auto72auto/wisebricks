(function () {
  var mobileQuery = window.matchMedia("(max-width: 740px)");

  function closeAll(groups, except) {
    groups.forEach(function (group) {
      if (group !== except) {
        group.classList.remove("open");
      }
    });
  }

  function insertSiteDisclaimer() {
    if (document.querySelector(".site-disclaimer")) return;

    var main = document.querySelector("main");
    if (!main) return;

    var disclaimer = document.createElement("section");
    disclaimer.className = "site-disclaimer";
    disclaimer.setAttribute("role", "note");
    disclaimer.textContent = "Wise Bricks is an independent fan-run LEGO research and comparison site. LEGO is a trademark of the LEGO Group, which does not sponsor, authorize, or endorse this site.";

    main.insertAdjacentElement("afterbegin", disclaimer);
  }

  function initNav(nav) {
    var groups = Array.from(nav.querySelectorAll(".nav-group"));
    if (!groups.length) return;

    groups.forEach(function (group) {
      var parent = group.querySelector(".nav-parent");
      if (!parent) return;

      parent.addEventListener("click", function (event) {
        if (!mobileQuery.matches) return;

        // First tap opens submenu. Second tap on same parent follows link.
        if (!group.classList.contains("open")) {
          event.preventDefault();
          closeAll(groups, group);
          group.classList.add("open");
        }
      });
    });

    document.addEventListener("click", function (event) {
      if (!mobileQuery.matches) return;
      if (!nav.contains(event.target)) {
        closeAll(groups, null);
      }
    });

    mobileQuery.addEventListener("change", function (e) {
      if (!e.matches) {
        closeAll(groups, null);
      }
    });
  }

  insertSiteDisclaimer();
  document.querySelectorAll("nav.nav").forEach(initNav);
})();
