"use strict";

const termsTemplate = {
  ops: [
    { insert: "Einwilligungserklärung\n", attributes: { header: 2 } },
    { insert: "Ich willige ein, dass meine personenbezogenen Daten (z. B. Name, Benutzerkennung, eingereichte Inhalte, Bewertungen, Interaktionen und IP-Adresse) zum Zweck der Durchführung der Anwendung verarbeitet werden dürfen. Zusätzlich willige ich in die Verarbeitung meiner personenbezogenen Daten für Forschungszwecke ein, sofern ich separat zugestimmt habe.\n\n" },

    { insert: "Informationen und Datenschutzerklärung\n", attributes: { header: 2 } },
    { insert: "Die Datenverarbeitung erfolgt unter Beachtung geltender Datenschutzgesetze (z. B. DSGVO). Alle Daten werden ausschließlich zu den im Informationsblatt beschriebenen Zwecken verwendet.\n\n" },

    { insert: "1. Bezeichnung der Verarbeitungstätigkeit\n", attributes: { header: 3 } },
    { insert: "Verarbeitung personenbezogener Daten zur Durchführung der Anwendung und optional zur wissenschaftlichen Auswertung von Nutzungsverhalten und Feedback.\n\n" },

    { insert: "2. Datenverantwortlicher\n", attributes: { header: 3 } },
    { insert: "Verantwortliche Organisation:\n", attributes: { bold: true } },
    { insert: "[Name der Organisation]\n[Adresse]\n[E-Mail-Adresse oder Kontaktlink]\n\n" },

    { insert: "3. Datenschutzbeauftragter\n", attributes: { header: 3 } },
    { insert: "[Name/Titel des Datenschutzbeauftragten]\n[Organisation oder Kontaktstelle]\n[Adresse]\n[E-Mail oder Datenschutzlink]\n\n" },

    { insert: "4. Zweck(e) und Rechtsgrundlage(n) der Verarbeitung\n", attributes: { header: 3 } },
    { insert: "Zwecke:\n", attributes: { bold: true } },
    { insert: "Bewertung und Durchführung der Anwendung", attributes: { list: "bullet" } },
    { insert: "Eindeutige Zuordnung über Benutzerkennungen", attributes: { list: "bullet" } },
    { insert: "Nutzung anonymisierter Daten für Forschung und Publikation (bei Zustimmung)", attributes: { list: "bullet" } },
    { insert: "Analyse des Nutzungsverhaltens (z. B. Klicks, Navigation, Zeitstempel)", attributes: { list: "bullet" } },
    { insert: "Technisch notwendige IP-Verarbeitung (nicht gespeichert)\n", attributes: { list: "bullet" } },
    { insert: "\nRechtsgrundlage:\n", attributes: { bold: true } },
    { insert: "Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)\n\n" },

    { insert: "5. Dauer der Speicherung\n", attributes: { header: 3 } },
    { insert: "Personenbezogene Daten werden für einen definierten Zeitraum (z. B. zwei Jahre nach Abschluss) gespeichert und anschließend gelöscht oder anonymisiert.\n\n" },

    { insert: "6. Rechte der betroffenen Personen\n", attributes: { header: 3 } },
    { insert: "Recht auf Auskunft", attributes: { list: "bullet" } },
    { insert: "Recht auf Berichtigung", attributes: { list: "bullet" } },
    { insert: "Recht auf Löschung oder Einschränkung", attributes: { list: "bullet" } },
    { insert: "Recht auf Widerspruch", attributes: { list: "bullet" } },
    { insert: "Recht auf Datenübertragbarkeit", attributes: { list: "bullet" } },
    { insert: "Beschwerderecht bei einer Aufsichtsbehörde\n", attributes: { list: "bullet" } },
    { insert: "\n" },

    { insert: "7. Widerrufsrecht\n", attributes: { header: 3 } },
    { insert: "Die Einwilligung kann jederzeit widerrufen werden. Die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt unberührt. Nach Anonymisierung ist keine nachträgliche Löschung mehr möglich.\n\n" },

    { insert: "8. Veröffentlichung anonymisierter Daten\n", attributes: { header: 3 } },
    { insert: "Anonymisierte Ergebnisse können in wissenschaftlichen Publikationen veröffentlicht werden. Die Daten werden unter einer offenen Lizenz (z. B. CC BY-NC 4.0) in geeigneten Repositorien veröffentlicht.\n" }
  ]
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate(
      'setting',
      {
        value: termsTemplate,
        updatedAt: new Date()
      },
      {
        key: 'app.register.terms'
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate(
      'setting',
      {
        value: '<p>Terms were reverted. Please restore the correct version manually.</p>',
        updatedAt: new Date()
      },
      {
        key: 'app.register.terms'
      }
    );
  }
};