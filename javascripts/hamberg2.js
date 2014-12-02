$(document).ready(function(){
	
	$('ul.hidden a').attr("rel", ""); // compensate for fancybox bug.
	
	var fb_opts = {
		cyclic: true,
		overlayOpacity: .8,
		overlayColor: '#000'
	};
	$('#photos-list a').fancybox(fb_opts);
	$('#filters a').click(function(e){
		e.preventDefault()
		var preferences = {
			duration: 800,
			easing: 'easeInOutQuad',
			adjustHeight: false
		};
		preferences.useScaling = true;
		var $dest = $('#destination-' + $(this).attr("id").replace(/filter-/, "") + " li");
		$('#photos-list a').unbind("click"); // cleanup – unbind old listener
		$('#photos-list').quicksand($dest, preferences, function(){
			$('#photos-list a').attr("rel", "gallery").fancybox(fb_opts); // and add it to the new elements when they've been inserted.
		});
	});
});
