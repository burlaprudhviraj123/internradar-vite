import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Setting up the worker src is required for pdf.js to not crash the main browser thread
// Apply a cache-busting query parameter to prevent the browser from serving a dead cached worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `${pdfWorker}?v=${Date.now()}`;

/**
 * Extracts all text from a locally uploaded PDF file.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  
  // Wrap the extraction in a timeout so it never hangs infinitely
  const extractionPromise = new Promise<string>(async (resolve, reject) => {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDocument = await loadingTask.promise;
      
      let fullText = '';
      const numPages = pdfDocument.numPages;

      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        
        const pageStrings = textContent.items.map((item: any) => item.str);
        fullText += pageStrings.join(' ') + '\n';
      }

      resolve(fullText);
    } catch (error) {
      console.error("PDF extraction error: ", error);
      reject(new Error('Failed to parse PDF document. Ensure the PDF contains actual text and is not just scanned images.'));
    }
  });

  // 15 second maximum timeout for PDF extraction
  const timeoutPromise = new Promise<string>((_, reject) => {
    setTimeout(() => {
      reject(new Error("PDF extraction timed out. Please try a different or smaller file."));
    }, 15000); // 15 seconds
  });

  return Promise.race([extractionPromise, timeoutPromise]);
}
