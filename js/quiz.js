// Quiz + flashcards; answers saved in localStorage.
const Quiz = {
  KEY: 'embedded-quiz-answers',
  load() { try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; } catch { return {}; } },
  save(a) { try { localStorage.setItem(this.KEY, JSON.stringify(a)); } catch {} },

  render(questions, list, scoreEl) {
    const answers = this.load();
    const updateScore = () => {
      const done = Object.keys(answers).length;
      const right = questions.filter((q, i) => answers[i] === q.answer).length;
      scoreEl.textContent = `– ${right}/${questions.length} đúng (${done} đã làm)`;
    };
    list.innerHTML = '';
    questions.forEach((q, i) => {
      const box = document.createElement('div');
      box.className = 'card q';
      box.innerHTML = `<p><b>Câu ${i + 1}.</b> ${q.q}</p>`;
      const explain = document.createElement('p');
      explain.className = 'explain';
      const show = chosen => {
        box.querySelectorAll('.opt').forEach((b, j) => {
          b.disabled = true;
          if (j === q.answer) b.classList.add('ok');
          else if (j === chosen) b.classList.add('bad');
        });
        explain.textContent = (chosen === q.answer ? '✅ Đúng. ' : '❌ Sai. ') + q.explain;
      };
      q.options.forEach((opt, j) => {
        const b = document.createElement('button');
        b.className = 'opt';
        b.textContent = `${'ABCD'[j]}. ${opt}`;
        b.onclick = () => { answers[i] = j; this.save(answers); show(j); updateScore(); };
        box.appendChild(b);
      });
      box.appendChild(explain);
      if (i in answers) show(answers[i]);
      list.appendChild(box);
    });
    updateScore();
  },

  reset() { this.save({}); },

  renderCards(cards, list) {
    list.innerHTML = '';
    cards.forEach(c => {
      const el = document.createElement('div');
      el.className = 'flash';
      el.tabIndex = 0;
      el.innerHTML = `<div class="inner"><div class="face"></div><div class="face back"></div></div>`;
      el.querySelector('.face').textContent = c.front;
      el.querySelector('.back').textContent = c.back;
      const flip = () => el.classList.toggle('flipped');
      el.onclick = flip;
      el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } };
      list.appendChild(el);
    });
  },
};
