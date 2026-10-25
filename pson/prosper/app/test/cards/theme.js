// Theme: ?theme=dark|light, else saved choice, else system preference. Shared by the app/test prototypes.
(function () {
  const KEY = 'prosper.test.theme';
  const q = new URLSearchParams(location.search).get('theme');
  let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  const sys = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const set = (t) => { document.documentElement.dataset.theme = t; };
  set(q === 'dark' || q === 'light' ? q : saved || sys);
  window.Theme = {
    get: () => document.documentElement.dataset.theme,
    set: (t) => { set(t); try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {} },
    button(btn) {
      const label = () => { btn.textContent = Theme.get() === 'dark' ? 'Light' : 'Dark'; };
      label(); btn.onclick = () => { Theme.set(Theme.get() === 'dark' ? 'light' : 'dark'); label(); };
    },
  };
})();
