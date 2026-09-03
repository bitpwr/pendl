import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Om | Pendl",
  description: "Om Pendl och hur tjänsten fungerar.",
};

export default function AboutPage() {
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Om Pendl</h1>
          <p className="mt-1.5 text-md text-muted-foreground">
            Pendl hjälper dig att snabbt hitta aktuella avgångar på de
            hållplatser du använder dagligen.
          </p>

          <p className="mt-1.5 text-md text-muted-foreground">
            De trafikområden som stöds:
          </p>
          <ul className="mt-1.5 text-md text-muted-foreground list-disc list-inside ml-6">
            <li>SL - Stockholms län</li>
            <li>UL - Uppsala län</li>
          </ul>
        </div>

        <div className="space-y-4 text-md leading-relaxed text-muted-foreground">
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              Hållplatser
            </h2>
            <p>
              Efter att ha valt ett trafikområde i menyn letar du upp de
              hållplatser du är intresserad av och kan sedan se de aktuella
              avgångarna i realtid. Du sparar enkelt hållplatser som favoriter,
              så visas de alltid på förstasidan.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              Avgångar
            </h2>
            <p>
              Om du väljer en hållplats visas de avgångar som är aktuella den
              kommande timmen, med tydlig indikering av eventuella förseningar.
              Överst på sidan kan du välja om du bara vill se vissa turer. Om du
              inte vill se en viss hållplats så kan du stänga den avdelningen.
              Det går även att visa hållplatsens position med kartikonen överst
              på sidan.
            </p>
            <p>
              Om tiderna visas i vitt så är det avgångar enligt tidtabell. Då
              det finns realtidsinformation så visas tiderna i grönt om avgången
              är i tid, orange om den är lite sen och i rött om den är mycket
              sen.
            </p>
            <p>
              Alla dina inställningar sparras i webbläsaren så att du inte
              behöver göra om dem nästa gång du besöker sidan.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Turer</h2>
            <p>
              Om du väljer en viss avgång så visas information om den turen, med
              alla dess hållplatser. Du kan även se var fordonet befinner sig
              just nu på kartan, och när den förväntas ankomma till de olika
              hållplatserna.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Karta</h2>
            <p>
              På kartan visas samtliga fordon i realtid. Genom att zooma in och
              markera olika fordon så kan man se vart den är på väg få en genväg
              till turen. Vill man bara se en viss fordonstyp så markerar man
              det enkelt ovanför kartan.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Källa</h2>
            <p>
              Informationen om alla avgångar hämtas från{" "}
              <a
                href="https://www.trafiklab.se/"
                className="underline hover:text-foreground"
              >
                Trafiklab
              </a>{" "}
              och deras tjänst GTFS Sweden 3. Tyvärr stöds för tillfället inte
              realtids positioner för pendeltåg men det förväntas komma under
              hösten 2026.
            </p>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Nyheter</h1>
            <h2 className="text-base font-semibold text-foreground">
              Augusti 2026
            </h2>
            <p>Bättre flyt i realtidspositioner för alla fordon.</p>
            <h2 className="text-base font-semibold text-foreground">
              Februari 2026
            </h2>
            <p>
              Pendl publiseras online för första gången. Tjänsten är i beta och
              innehåller endast SL som trafikområde.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
