export type AdminLayoutMenuItem = {
  path: string
  title: string
};

export type RenderAdminLayoutInput = {
  title: string
  content: string
  menu: AdminLayoutMenuItem[]
};

export function renderAdminLayout({ title, content, menu }: RenderAdminLayoutInput): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${title} - Nimb CMS</title>

<style>

body{
 font-family:sans-serif;
 margin:0;
 background:#f5f5f5;
}

.layout{
 display:flex;
 min-height:100vh;
}

.sidebar{
 width:220px;
 background:#1e293b;
 color:white;
 padding:20px;
}

.sidebar h2{
 margin-top:0;
 font-size:18px;
}

.sidebar a{
 display:block;
 color:white;
 text-decoration:none;
 padding:8px 0;
}

.sidebar a:hover{
 opacity:0.7;
}

.content{
 flex:1;
 background:white;
 padding:30px;
}

</style>

</head>

<body>

<div class="layout">

<div class="sidebar">

<h2>Nimb CMS</h2>

${menu.map((item) => `
<a href="${item.path}">
${item.title}
</a>
`).join('')}

</div>

<div class="content">

${content}

</div>

</div>

</body>
</html>`;
}
