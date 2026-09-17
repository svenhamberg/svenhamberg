/* Filtering + lightbox for the portfolio grid. No dependencies. */
(function () {
	'use strict';

	var grid = document.getElementById('photos');
	var filters = document.getElementById('filters');
	var dialog = document.getElementById('lightbox');
	if (!grid || !filters || !dialog) return;

	var items = Array.prototype.slice.call(grid.children);
	var stage = dialog.querySelector('.lb-stage');
	var count = dialog.querySelector('.lb-count');
	var prevBtn = dialog.querySelector('.lb-prev');
	var nextBtn = dialog.querySelector('.lb-next');
	var desc = document.getElementById('lb-desc');

	/* Two <img> elements leapfrog each other: one holds the photograph on show,
	   the other is parked off-stage holding whichever one you are dragging in. */
	var current = document.getElementById('lb-photo-a');
	var incoming = document.getElementById('lb-photo-b');

	/* The photos currently on show — what the lightbox pages through. */
	var visible = items.slice();
	var index = 0;
	var busy = false;
	var queued = 0;
	var opener = null;

	var DURATION = 280;
	var QUEUE_MAX = 3;
	var EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

	function motionOK() {
		return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/* Filtering */

	function applyFilter(name) {
		visible = [];
		items.forEach(function (li) {
			var show = name === 'all' || li.dataset.cat === name;
			li.hidden = !show;
			if (show) {
				visible.push(li);
				/* restart the fade so the new set animates in */
				li.style.animation = 'none';
				void li.offsetWidth;
				li.style.animation = '';
			}
		});
	}

	filters.addEventListener('click', function (e) {
		var btn = e.target.closest('.filter');
		if (!btn) return;
		filters.querySelectorAll('.filter').forEach(function (b) {
			b.setAttribute('aria-pressed', String(b === btn));
		});
		applyFilter(btn.dataset.filter);
		btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	});

	/* Lightbox */

	function srcOf(li) {
		return li.querySelector('a').href;
	}

	/* The description goes to a screen-reader-only element, never to the
	   element's alt: an <img> that is empty or still decoding paints its alt
	   text across the stage. */
	function load(el, li) {
		el.src = srcOf(li);
	}

	function describe(li) {
		desc.textContent = li.querySelector('img').alt;
	}

	function neighbour(dir) {
		return (index + dir + visible.length) % visible.length;
	}

	function place(el, x) {
		el.style.transform = 'translateX(' + x + 'px)';
	}

	/* How far a photograph travels to leave the stage. Deliberately the widest
	   the stage can ever be rather than its width right now: mid-morph the box
	   is between two sizes, and a distance measured then can be shorter than
	   the box ends up, which lets the outgoing photograph overlap the incoming
	   one and show through its letterboxing. */
	function travel() {
		var limit = parseFloat(
			getComputedStyle(document.documentElement).getPropertyValue('--photo-max')
		) || 500;
		return Math.min(window.innerWidth, limit);
	}

	/* Size the stage to the box this photograph will actually fill, so the
	   close button, arrows and counter hug the picture. Never upscales past
	   the pixels the file has. */
	function fit(li) {
		var natural = { w: +li.dataset.w || 500, h: +li.dataset.h || 500 };
		var style = getComputedStyle(stage);
		var maxW = Math.min(window.innerWidth, parseFloat(style.maxWidth) || window.innerWidth);
		var maxH = parseFloat(style.maxHeight) || window.innerHeight;
		var limit = parseFloat(
			getComputedStyle(document.documentElement).getPropertyValue('--photo-max')
		) || 500;
		var scale = Math.min(maxW / natural.w, maxH / natural.h, limit / Math.max(natural.w, natural.h), 1);
		stage.style.width = Math.round(natural.w * scale) + 'px';
		stage.style.height = Math.round(natural.h * scale) + 'px';
	}

	function preload() {
		if (visible.length < 2) return;
		[neighbour(1), neighbour(-1)].forEach(function (i) {
			new Image().src = srcOf(visible[i]);
		});
	}

	function paint() {
		count.textContent = index + 1 + ' / ' + visible.length;
		describe(visible[index]);
		var solo = visible.length < 2;
		prevBtn.hidden = solo;
		nextBtn.hidden = solo;
	}

	function slide(el, from, to, easing) {
		return el.animate(
			[{ transform: 'translateX(' + from + 'px)' }, { transform: 'translateX(' + to + 'px)' }],
			{ duration: motionOK() ? DURATION : 0, easing: easing || EASE, fill: 'forwards' }
		);
	}

	/* Move to the next (dir 1) or previous (dir -1) photograph, picking up from
	   wherever a drag left the pictures. */
	function go(dir, fromX) {
		if (visible.length < 2) return;
		/* Presses that land mid-slide stack up rather than being dropped, so a
		   quick burst still walks through the set. Bounded, because a held-down
		   arrow key repeats about thirty times a second and the viewer should
		   settle when you let go rather than coasting for several seconds. */
		if (busy) {
			queued = Math.max(-QUEUE_MAX, Math.min(QUEUE_MAX, queued + dir));
			return;
		}
		busy = true;
		var target = neighbour(dir);
		var start = fromX || 0;

		/* a tap on an arrow starts the incoming photo just off the edge */
		if (!fromX) load(incoming, visible[target]);

		var width = travel();
		fit(visible[target]);
		place(incoming, start + dir * width);

		var out = slide(current, start, -dir * width);
		var into = slide(incoming, start + dir * width, 0);

		Promise.all([out.finished, into.finished]).then(function () {
			index = target;

			/* swap roles rather than swapping src, so nothing flickers */
			var shown = incoming;
			var parked = current;
			current = shown;
			incoming = parked;

			place(current, 0);
			place(incoming, width);
			current.removeAttribute('aria-hidden');
			incoming.setAttribute('aria-hidden', 'true');
			out.cancel();
			into.cancel();

			paint();
			preload();
			busy = false;

			if (queued) {
				var again = queued > 0 ? 1 : -1;
				queued -= again;
				go(again);
			}
		});
	}

	function open(li) {
		var i = visible.indexOf(li);
		if (i === -1) return;
		index = i;
		opener = li.querySelector('a');
		load(current, visible[index]);
		fit(visible[index]);
		place(current, 0);
		place(incoming, travel());
		current.removeAttribute('aria-hidden');
		incoming.setAttribute('aria-hidden', 'true');
		paint();
		if (typeof dialog.showModal === 'function') {
			dialog.showModal();
		} else {
			dialog.setAttribute('open', '');
		}
		document.body.style.overflow = 'hidden';
		/* park focus on the stage: <dialog> would otherwise hand it to the
		   close button, which then paints a focus ring nobody asked for */
		stage.focus({ preventScroll: true });
		preload();
	}

	function close() {
		if (typeof dialog.close === 'function') {
			dialog.close();
		} else {
			dialog.removeAttribute('open');
		}
	}

	grid.addEventListener('click', function (e) {
		var link = e.target.closest('a');
		if (!link || !grid.contains(link)) return;
		/* let modified clicks open the image in a new tab as usual */
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
		e.preventDefault();
		open(link.parentElement);
	});

	dialog.addEventListener('close', function () {
		document.body.style.overflow = '';
		current.removeAttribute('src');
		incoming.removeAttribute('src');
		desc.textContent = '';
		if (opener) {
			opener.focus({ preventScroll: true });
			opener = null;
		}
	});

	/* A click carries detail 0 only when the keyboard triggered it, so a mouse
	   or a finger leaves no focus ring behind while a keyboard user keeps one. */
	function onPress(button, fn) {
		button.addEventListener('click', function (e) {
			/* hand focus back to the stage rather than dropping it on the
			   document, so Tab still lands on the viewer's own controls */
			if (e.detail) stage.focus({ preventScroll: true });
			fn();
		});
	}

	onPress(dialog.querySelector('.lb-close'), close);
	onPress(prevBtn, function () {
		go(-1);
	});
	onPress(nextBtn, function () {
		go(1);
	});

	/* Clicking the dimmed area around the panel, or the letterboxing beside a
	   photograph, closes the viewer. */
	dialog.addEventListener('click', function (e) {
		if (e.target === dialog || e.target === stage) close();
	});

	document.addEventListener('keydown', function (e) {
		if (!dialog.open) return;
		if (e.key === 'ArrowRight') {
			e.preventDefault();
			go(1);
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			go(-1);
		}
		/* Escape is handled by <dialog> itself */
	});

	/* Swipe — the photograph tracks your finger, and the neighbour follows it in */

	var startX = 0;
	var startY = 0;
	var dx = 0;
	var dragDir = 0;
	var dragging = false;

	stage.addEventListener(
		'touchstart',
		function (e) {
			if (busy || visible.length < 2 || e.touches.length !== 1) return;
			dragging = true;
			dx = 0;
			dragDir = 0;
			startX = e.touches[0].clientX;
			startY = e.touches[0].clientY;
		},
		{ passive: true }
	);

	stage.addEventListener(
		'touchmove',
		function (e) {
			if (!dragging) return;
			var x = e.touches[0].clientX - startX;
			var y = e.touches[0].clientY - startY;
			/* a mostly-vertical first move is not a swipe */
			if (!dragDir && Math.abs(y) > Math.abs(x)) {
				dragging = false;
				return;
			}
			dx = x;
			var dir = dx < 0 ? 1 : -1;
			if (dir !== dragDir) {
				dragDir = dir;
				load(incoming, visible[neighbour(dir)]);
			}
			place(current, dx);
			place(incoming, dx + dragDir * travel());
		},
		{ passive: true }
	);

	function endDrag() {
		if (!dragging) return;
		dragging = false;
		var width = travel();
		if (!dragDir || !dx) return;

		/* far enough, or flicked hard enough, to count as a page turn */
		if (Math.abs(dx) > Math.max(48, width * 0.18)) {
			go(dragDir, dx);
		} else {
			busy = true;
			var back = slide(current, dx, 0, 'ease-out');
			var away = slide(incoming, dx + dragDir * width, dragDir * width, 'ease-out');
			Promise.all([back.finished, away.finished]).then(function () {
				place(current, 0);
				place(incoming, width);
				back.cancel();
				away.cancel();
				busy = false;
			});
		}
		dx = 0;
		dragDir = 0;
	}

	window.addEventListener('resize', function () {
		if (dialog.open && !busy) fit(visible[index]);
	});

	stage.addEventListener('touchend', endDrag, { passive: true });
	stage.addEventListener('touchcancel', endDrag, { passive: true });
})();
