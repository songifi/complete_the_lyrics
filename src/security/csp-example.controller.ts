import { Controller, Get, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { RequestWithNonce } from "./csp.middleware";
import { getCspNonce, scriptWithNonce, styleWithNonce } from "./csp.utils";

function escapeHtml(value: string): string {
  if (value == null) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

@Controller("csp-example")
export class CspExampleController {
  @Get("basic")
  getBasicExample(@Req() req: RequestWithNonce) {
    const nonce = getCspNonce(req);
    const escapedNonce = escapeHtml(nonce);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>CSP Nonce Example</title>
          <style nonce="${escapedNonce}">
            body {
              font-family: Arial, sans-serif;
              margin: 40px;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .highlight {
              background-color: #fff3cd;
              border: 1px solid #ffeaa7;
              padding: 15px;
              border-radius: 4px;
              margin: 20px 0;
            }
            code {
              background-color: #f8f9fa;
              padding: 2px 4px;
              border-radius: 3px;
              font-family: 'Courier New', monospace;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Content Security Policy Nonce Example</h1>

            <div class="highlight">
              <h3>Security Status:  Secure</h3>
              <p>This page uses nonce-based CSP instead of unsafe tokens.</p>
              <p><strong>Nonce:</strong> <code>${escapeHtml(nonce)}</code></p>
            </div>

            <h2>Inline Script Example</h2>
            <p>This script will execute because it has the correct nonce:</p>
            <script nonce="${escapedNonce}">
              console.log('Script executed successfully with nonce');

              document.addEventListener('DOMContentLoaded', function() {
                const statusDiv = document.createElement('div');
                statusDiv.innerHTML = '<p><strong>Script executed successfully!</strong></p>';
                statusDiv.style.color = 'green';
                document.body.appendChild(statusDiv);
              });
            </script>

            <h2>Inline Style Example</h2>
            <p>This style will apply because it has the correct nonce:</p>
            <style nonce="${escapedNonce}">
              .dynamic-style {
                color: #28a745;
                font-weight: bold;
                border-left: 4px solid #28a745;
                padding-left: 15px;
                margin: 20px 0;
              }
            </style>

            <div class="dynamic-style">
              This text is styled with a nonce-protected inline style.
            </div>

            <h2>Utility Function Examples</h2>
            <p>Using the CSP utility functions:</p>
            ${scriptWithNonce(
              req,
              `
              console.log('Utility function script executed');
              document.body.innerHTML += '<p><em> Utility script executed</em></p>';
            `,
            )}

            ${styleWithNonce(
              req,
              `
              .utility-style {
                background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
                margin: 20px 0;
              }
            `,
            )}

            <div class="utility-style">
              This is styled using the styleWithNonce utility function.
            </div>

            <h2>Security Notes</h2>
            <ul>
              <li> All inline scripts have nonce attributes</li>
              <li> All inline styles have nonce attributes</li>
              <li> Nonce is cryptographically random per request</li>
              <li> CSP blocks any inline content without nonces</li>
              <li> No unsafe-inline or unsafe-eval tokens used</li>
            </ul>

            <h2>Testing CSP Violations</h2>
            <p>Try adding a script without a nonce to see it blocked:</p>
            <p><code>&lt;script&gt;alert('This will be blocked');&lt;/script&gt;</code></p>

            <script nonce="${escapedNonce}">
              document.addEventListener('DOMContentLoaded', function() {
                const testButton = document.createElement('button');
                testButton.textContent = 'Test CSP Violation';
                testButton.onclick = function() {
                  eval('alert("CSP should block this eval() call")');
                };
                testButton.style.cssText = 'padding: 10px; margin: 20px 0; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;';
                document.body.appendChild(testButton);
              });
            </script>
          </div>
        </body>
      </html>
    `;
  }

  @Get("api")
  getApiExample(@Req() req: RequestWithNonce, @Res() res: Response) {
    res.json({
      message: "CSP headers are automatically set by middleware",
      nonce: req.cspNonce,
      timestamp: new Date().toISOString(),
      security: {
        cspEnabled: true,
        nonceGenerated: !!req.cspNonce,
        nonceLength: req.cspNonce?.length || 0,
      },
    });
  }

  @Get("error-test")
  getErrorExample(@Req() req: RequestWithNonce) {
    const nonce = req.cspNonce || "";
    const escapedNonce = escapeHtml(nonce);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>CSP Error Test</title>
        </head>
        <body>
          <h1>CSP Error Test</h1>

          <p>This script will be blocked by CSP (missing nonce):</p>
          <script>
            console.log('This should be blocked');
          </script>

          <p>This script will execute (has nonce):</p>
          <script nonce="${escapedNonce}">
            console.log('This should execute');
            document.body.innerHTML += '<p> Script with nonce executed</p>';
          </script>

          <p>Check the browser console for CSP violation messages.</p>
        </body>
      </html>
    `;
  }
}
