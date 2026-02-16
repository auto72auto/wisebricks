(function () {
  var mobileQuery = window.matchMedia("(max-width: 740px)");

  function closeAll(groups, except) {
    groups.forEach(function (group) {
      if (group !== except) {
        group.classList.remove("open");
      }
    });
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

  document.querySelectorAll("nav.nav").forEach(initNav);
})();
