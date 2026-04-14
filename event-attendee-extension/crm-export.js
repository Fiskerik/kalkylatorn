// crm-export.js
// Drop this file into your extension folder and add:
//   <script src="crm-export.js"></script>
// in sidepanel.html BEFORE sidepanel.js

const CRM_PROFILES = {
  hubspot: {
    label: "HubSpot",
    headers: ["First Name", "Last Name", "Job Title", "City", "Country/Region", "LinkedIn URL"],
    row: (a) => {
      const [first, ...rest] = splitName(a.name);
      const [city, country] = splitLocation(a.location);
      return [first, rest.join(" "), a.title, city, country, a.profileLink];
    }
  },

  pipedrive: {
    label: "Pipedrive",
    headers: ["Name", "Title", "Location", "LinkedIn"],
    row: (a) => [a.name, a.title, a.location, a.profileLink]
  },

  salesforce: {
    label: "Salesforce",
    headers: ["FirstName", "LastName", "Title", "MailingCity", "MailingCountry", "Description"],
    row: (a) => {
      const [first, ...rest] = splitName(a.name);
      const [city, country] = splitLocation(a.location);
      return [first, rest.join(" "), a.title, city, country, a.profileLink];
    }
  },

  zoho: {
    label: "Zoho CRM",
    headers: ["First Name", "Last Name", "Title", "City", "Country", "LinkedIn Profile"],
    row: (a) => {
      const [first, ...rest] = splitName(a.name);
      const [city, country] = splitLocation(a.location);
      return [first, rest.join(" "), a.title, city, country, a.profileLink];
    }
  },

  generic: {
    label: "Generic CSV",
    headers: ["Name", "Title", "Location", "Profile Link", "Email", "Phone", "Website"],
    row: (a) => [a.name, a.title, a.location, a.profileLink, a.email, a.phone, a.website]
  }
};

function splitName(fullName) {
  const parts = (fullName || "").trim().split(/\s+/);
  return parts.length > 1 ? parts : [parts[0], ""];
}

function splitLocation(location) {
  // Tries to extract "City, Country" from strings like
  // "Stockholm, Stockholm County, Sweden" or "London, England, United Kingdom"
  if (!location) return ["", ""];
  const parts = location.split(",").map(s => s.trim());
  if (parts.length === 1) return [parts[0], ""];
  // Last part is usually country, first is city
  return [parts[0], parts[parts.length - 1]];
}

function buildCrmCsv(attendees, profileKey) {
  const profile = CRM_PROFILES[profileKey] ?? CRM_PROFILES.generic;
  const rows = attendees.map(profile.row);
  return [profile.headers, ...rows]
    .map(line => line.map(escapeCsvCell).join(","))
    .join("\n");
}

function escapeCsvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

// Make available globally for sidepanel.js
window.CRM_PROFILES = CRM_PROFILES;
window.buildCrmCsv = buildCrmCsv;
