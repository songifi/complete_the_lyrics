/**
 * Demonstration script for the new SemVer-aware version comparison
 * This shows how the updated compareVersions function handles various version scenarios
 */

// Import the middleware to test the function
import { ApiVersioningMiddleware } from "./api-versioning.middleware";

function demonstrateSemVerComparison() {
  const middleware = new ApiVersioningMiddleware();

  // Access the private method for demonstration
  const compareVersions = (a: string, b: string) => {
    return (
      middleware as unknown as {
        compareVersions(a: string, b: string): number;
      }
    ).compareVersions(a, b);
  };

  console.log("=== SemVer Comparison Demonstration ===\n");

  // Test 1: Basic version comparison
  console.log("1. Basic version comparison:");
  console.log(
    `   compareVersions("2.0", "1.0") = ${compareVersions("2.0", "1.0")} (should be > 0)`,
  );
  console.log(
    `   compareVersions("1.0", "2.0") = ${compareVersions("1.0", "2.0")} (should be < 0)`,
  );
  console.log(
    `   compareVersions("1.0", "1.0") = ${compareVersions("1.0", "1.0")} (should be = 0)\n`,
  );

  // Test 2: Prerelease vs stable
  console.log("2. Prerelease vs stable versions:");
  console.log(
    `   compareVersions("1.0", "1.0-beta") = ${compareVersions("1.0", "1.0-beta")} (stable > prerelease)`,
  );
  console.log(
    `   compareVersions("1.0-beta", "1.0") = ${compareVersions("1.0-beta", "1.0")} (prerelease < stable)\n`,
  );

  // Test 3: Prerelease ordering
  console.log("3. Prerelease ordering:");
  console.log(
    `   compareVersions("1.0-alpha", "1.0-beta") = ${compareVersions("1.0-alpha", "1.0-beta")} (alpha < beta)`,
  );
  console.log(
    `   compareVersions("1.0-beta", "1.0-rc") = ${compareVersions("1.0-beta", "1.0-rc")} (beta < rc)`,
  );
  console.log(
    `   compareVersions("1.0-rc", "1.0-alpha") = ${compareVersions("1.0-rc", "1.0-alpha")} (rc > alpha)\n`,
  );

  // Test 4: Numeric prerelease identifiers
  console.log("4. Numeric prerelease identifiers:");
  console.log(
    `   compareVersions("1.0-alpha.1", "1.0-alpha.2") = ${compareVersions("1.0-alpha.1", "1.0-alpha.2")} (1 < 2)`,
  );
  console.log(
    `   compareVersions("1.0-alpha.10", "1.0-alpha.2") = ${compareVersions("1.0-alpha.10", "1.0-alpha.2")} (10 > 2)\n`,
  );

  // Test 5: Mixed numeric and non-numeric
  console.log("5. Mixed numeric and non-numeric:");
  console.log(
    `   compareVersions("1.0-alpha.1", "1.0-alpha.beta") = ${compareVersions("1.0-alpha.1", "1.0-alpha.beta")} (numeric < non-numeric)`,
  );
  console.log(
    `   compareVersions("1.0-alpha.beta", "1.0-alpha.1") = ${compareVersions("1.0-alpha.beta", "1.0-alpha.1")} (non-numeric > numeric)\n`,
  );

  // Test 6: Complex prerelease strings
  console.log("6. Complex prerelease strings:");
  console.log(
    `   compareVersions("1.0-alpha.1.beta.2", "1.0-alpha.1.beta.3") = ${compareVersions("1.0-alpha.1.beta.2", "1.0-alpha.1.beta.3")} (2 < 3)`,
  );
  console.log(
    `   compareVersions("1.0-alpha.1.beta", "1.0-alpha.1.beta.1") = ${compareVersions("1.0-alpha.1.beta", "1.0-alpha.1.beta.1")} (shorter < longer)\n`,
  );

  // Test 7: Edge cases
  console.log("7. Edge cases:");
  console.log(
    `   compareVersions("", "") = ${compareVersions("", "")} (empty strings)`,
  );
  console.log(
    `   compareVersions("1.0+build.1", "1.0+build.2") = ${compareVersions("1.0+build.1", "1.0+build.2")} (build metadata ignored)\n`,
  );

  // Test 8: Real-world API version scenarios
  console.log("8. Real-world API version scenarios:");
  const versions = ["1.0-alpha", "1.0-beta", "1.0-rc", "1.0", "1.1", "2.0"];
  console.log(`   Original order: ${versions.join(", ")}`);

  const sortedVersions = [...versions].sort(compareVersions);
  console.log(`   Sorted order: ${sortedVersions.join(", ")}`);

  console.log("\n=== End of Demonstration ===");
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateSemVerComparison();
}

export { demonstrateSemVerComparison };
