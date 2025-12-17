# <img src="./public/favicon.svg" alt="Project Logo" width="30" height="30" style="vertical-align: middle; margin-right: 8px;"> GPT-IMAGE-1.5 Playground

A web-based playground to interact with OpenAI's `gpt-image-1.5` model for generating and editing images.

<p align="center">
  <img src="./readme-images/interface.jpg" alt="Interface" width="600"/>
</p>

## ✨ Features

*   **🎨 Image Generation Mode:** Create new images from text prompts.
*   **🖌️ Image Editing Mode:** Modify existing images based on text prompts and optional masks.
*   **⚙️ Full API Parameter Control:** Access and adjust all relevant parameters supported by the OpenAI Images API directly through the UI (size, quality, output format, compression, background, moderation, number of images).
*   **🎭 Integrated Masking Tool:** Easily create or upload masks directly within the editing mode to specify areas for modification. Draw directly on the image to generate a mask.

<p align="center">
  <img src="./readme-images/mask-creation.jpg" alt="Interface" width="350"/>
</p>

*   **📜 Detailed History & Cost Tracking:**
    *   View a comprehensive history of all your image generations and edits.
    *   See the parameters used for each request.
    *   Get detailed API token usage and estimated cost breakdowns ($USD) for each operation.
    *   View the full prompt used for each history item. (hint: click the $ amount on the image)
    *   View total historical API cost.

<p align="center">
  <img src="./readme-images/history.jpg" alt="Interface" width="800"/>
</p>

<p align="center">
  <img src="./readme-images/cost-breakdown.jpg" alt="Interface" width="350"/>
</p>

*   **🖼️ Flexible Image Output View:** View generated image batches as a grid or select individual images for a closer look.
*   **🚀 Send to Edit:** Quickly send any generated or history image directly to the editing form.
*   **📋 Paste to Edit:** Paste images directly from your clipboard into the Edit mode's source image area.
*   **💾 Storage:** Images are saved automatically to ./generated-images and your generation history is saved in your browser's local storage.

## 🚀 Getting Started

Follow these steps to get the playground running locally.

### Prerequisites

*   [Node.js](https://nodejs.org/) (Version 18 or later recommended)
*   [npm](https://www.npmjs.com/), [yarn](https://yarnpkg.com/), [pnpm](https://pnpm.io/), or [bun](https://bun.sh/)

### 1. Set Up API Key

You need an API key to use this application. You can configure it to use either a standard OpenAI API key or an Azure OpenAI deployment.

**Option 1: Standard OpenAI API Key**

1.  If you don't have a `.env.local` file in the project root, create one.
2.  Add your OpenAI API key to the `.env.local` file:

    ```dotenv
    # .env.local
    OPENAI_API_KEY=your_openai_api_key_here
    ```

**Option 2: Azure OpenAI Service**

1.  Ensure you have an Azure OpenAI resource and a model deployment (e.g., for `gpt-image-1.5`).
2.  If you don't have a `.env.local` file in the project root, create one.
3.  Add your Azure OpenAI credentials and deployment details to the `.env.local` file:

    ```dotenv
    # .env.local
    AZURE_OPENAI_API_KEY=your_azure_api_key
    AZURE_OPENAI_ENDPOINT=your_azure_endpoint # e.g., https://your-resource-name.openai.azure.com/
    AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name # The name you gave your model deployment
    AZURE_OPENAI_API_VERSION=your_api_version # e.g., 2025-04-01-preview
    ```

**How it Works:**

The application will automatically detect if the Azure environment variables (`AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME`, `AZURE_OPENAI_API_VERSION`) are set in `.env.local`. If they are, it will use the Azure OpenAI client. Otherwise, it will fall back to using the standard OpenAI client if `OPENAI_API_KEY` is set.

**Important:** Keep your API keys and endpoint information secret. The `.env.local` file is included in `.gitignore` by default to prevent accidental commits.

### 2. Install Dependencies

Navigate to the project directory in your terminal and install the necessary packages:

```bash
npm install
# or
# yarn install
# or
# pnpm install
# or
# bun install
```

### 3. Run the Development Server

Start the Next.js development server:

```bash
npm run dev
# or
# yarn dev
# or
# pnpm dev
# or
# bun dev
```

### 4. Open the Playground

Open [http://localhost:3000](http://localhost:3000) in your web browser. You should now be able to use the gpt-image-1.5 Playground!

## 🏭 Production Run (Bun + PM2)

1. Build the app:

```bash
bun run build
```

2. Start in production on port 3000 and keep it alive with PM2 (same port your Cloudflare tunnel uses):

```bash
pm2 start bun --name "gptimage" -- start -- --hostname 0.0.0.0 --port 3000
```

3. Manage the process:

```bash
pm2 status
pm2 logs gptimage
pm2 restart gptimage
pm2 stop gptimage
```

Notes:
- Ensure `.env.local` (or exported env vars) is available in the project root so Next.js can read it when PM2 starts the process.
- If you want PM2 to relaunch on reboot, run `pm2 save` after starting.

## 🤝 Contributing

Contributions are welcome! Issues and feature requests, not as much welcome but I'll think about it.

## 📄 License

MIT
