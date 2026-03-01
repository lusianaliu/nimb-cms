export const renderMediaUpload = () => `<h1>Upload media</h1>
<p><a href="/admin/media">Back to media list</a></p>
<form method="post" action="/admin/media/upload" enctype="multipart/form-data">
  <div>
    <label for="file">Select file</label>
    <input id="file" name="file" type="file" required />
  </div>
  <p><button type="submit">Upload</button></p>
</form>`;
