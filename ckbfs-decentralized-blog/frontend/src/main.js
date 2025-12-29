import './style.css'

document.querySelector('#app').innerHTML = `
  <div class="container">
    <h1>Decentralized Blog</h1>

    <!-- Blog content will be fetched from CKBFS using stored CIDs -->

    <article>
      <h2>Hello World</h2>
      <p>
        This is my first decentralized blog post.
        Content and metadata will be stored using CKBFS.
      </p>
    </article>

    <footer>
      Powered by Nervos CKB & CKBFS
    </footer>
  </div>
`
