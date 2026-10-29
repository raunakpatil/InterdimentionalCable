// Wall poster manifest. Native-resolution WebP, ordered for the gallery.
// The 25 original prints lay out as 14 regular + Pop Transformation on the
// back wall and 10 on the left wall. The five `topRow` entries at the end fill
// the empty top slot of each column. See POSTER_PANELS in three-scene.js.
window.ROOM_POSTERS = [
  { src: "assets/posters/01-zathura.webp", w: 736, h: 1090, title: "Zathura" },
  { src: "assets/posters/05-dhoom.webp", w: 550, h: 859, title: "Dhoom" },
  { src: "assets/posters/09-poster-03.webp", w: 696, h: 1200, title: "Poster 03" },
  { src: "assets/posters/15-jurassic-park.webp", w: 736, h: 1104, title: "Jurassic Park" },
  { src: "assets/posters/16-kanye-west.webp", w: 736, h: 981, title: "Kanye West" },
  { src: "assets/posters/17-samdraw1ngs.webp", w: 736, h: 1041, title: "Samdraw1ngs" },
  { src: "assets/posters/20-retro-texture.webp", w: 735, h: 1058, title: "Retro Texture" },
  { src: "assets/posters/22-rekha.webp", w: 500, h: 704, title: "Rekha" },
  { src: "assets/posters/02-beparwah.webp", w: 736, h: 1041, title: "Beparwah" },
  { src: "assets/posters/03-buddha.webp", w: 735, h: 1051, title: "Buddha" },
  { src: "assets/posters/04-career-advice.webp", w: 736, h: 981, title: "Career Advice" },
  { src: "assets/posters/06-daft-punk.webp", w: 736, h: 880, title: "Daft Punk" },
  { src: "assets/posters/07-poster-01.webp", w: 736, h: 780, title: "Poster 01" },
  { src: "assets/posters/08-poster-02.webp", w: 736, h: 981, title: "Poster 02" },
  { src: "assets/posters/10-poster-04.webp", w: 528, h: 750, title: "Poster 04" },
  { src: "assets/posters/11-poster-05.webp", w: 564, h: 705, title: "Poster 05" },
  { src: "assets/posters/12-poster-06.webp", w: 585, h: 847, title: "Poster 06" },
  { src: "assets/posters/13-poster-07.webp", w: 736, h: 920, title: "Poster 07" },
  { src: "assets/posters/14-gangs-of-wasseypur.webp", w: 736, h: 1041, title: "Gangs of Wasseypur" },
  { src: "assets/posters/18-michael-scott.webp", w: 736, h: 1041, title: "Michael Scott" },
  { src: "assets/posters/19-nike-india.webp", w: 736, h: 981, title: "Nike in India" },
  { src: "assets/posters/21-ps2-y2k.webp", w: 736, h: 920, title: "PS2 Y2K" },
  { src: "assets/posters/23-salman-khan.webp", w: 736, h: 920, title: "Salman Khan" },
  { src: "assets/posters/24-superbad.webp", w: 736, h: 981, title: "Superbad" },
  { src: "assets/posters/25-pop-transformation.webp", w: 768, h: 1376, title: "Pop Transformation" },

  // One new print per column, mounted in the empty top slots left by the
  // wrapped regular row. Keep these last so the original layout is unchanged.
  { src: "assets/posters/26-golden-era.webp", w: 736, h: 1104, title: "Golden Era", topRow: true },
  { src: "assets/posters/27-kill-bill.webp", w: 735, h: 1045, title: "Kill Bill", topRow: true },
  { src: "assets/posters/28-megan-fox.webp", w: 736, h: 1041, title: "Megan Fox", topRow: true },
  { src: "assets/posters/29-michael-jackson.webp", w: 735, h: 1040, title: "Michael Jackson", topRow: true },
  { src: "assets/posters/30-titanic.webp", w: 736, h: 1104, title: "Titanic", topRow: true },
];
