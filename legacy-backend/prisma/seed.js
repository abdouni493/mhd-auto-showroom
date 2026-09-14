import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const makeRef = (prefix, id) => `${prefix}-${new Date().getFullYear()}-${String(id).padStart(4, "0")}`;

async function main() {
  console.log("🌱 Seeding database...");

  // --- Demo admin ---
  const passwordHash = await bcrypt.hash("demo1234", 10);
  await prisma.user.upsert({
    where: { email: "demo@showroom.dz" },
    update: {},
    create: {
      fullName: "Administrateur Démo",
      username: "demo",
      email: "demo@showroom.dz",
      passwordHash,
      role: "ADMIN",
    },
  });

  // --- Showroom ---
  const existingShowroom = await prisma.showroom.findFirst();
  if (!existingShowroom) {
    await prisma.showroom.create({
      data: {
        name: "PRESTIGE AUTO",
        description: "Votre showroom automobile de prestige — véhicules d'exception, service premium.",
        email: "contact@prestige-auto.dz",
        phone: "+213 555 12 34 56",
        address: "12 Boulevard des Martyrs, Alger, Algérie",
        nif: "099916001234567",
        nis: "000916001234567",
        article: "16001234567",
        rc: "16/00-1234567B23",
      },
    });
  }

  // --- Car document types ---
  const docTypes = ["Carte Grise", "Carte d'immatriculation", "Contrôle Technique", "Assurance", "Facture d'achat", "Certificat de cession"];
  for (const name of docTypes) {
    await prisma.carDocumentType.upsert({ where: { name }, update: {}, create: { name } });
  }

  // --- Website contacts ---
  const existingContacts = await prisma.websiteContact.findFirst();
  if (!existingContacts) {
    await prisma.websiteContact.create({
      data: {
        facebook: "https://facebook.com/prestigeauto",
        instagram: "https://instagram.com/prestigeauto",
        tiktok: "https://tiktok.com/@prestigeauto",
        maps: "https://maps.google.com/?q=Alger",
        whatsapp: "+213555123456",
      },
    });
  }

  // Skip the rest if cars already exist
  const carCount = await prisma.car.count();
  if (carCount > 0) {
    console.log("✅ Data already seeded, skipping sample data.");
    return;
  }

  // --- Worker roles ---
  const adminRole = await prisma.workerRole.create({
    data: {
      name: "Vendeur",
      permissions: JSON.stringify({
        dashboard: { view: true },
        showroom: { view: true },
        pos: { view: true, create: true },
        sales: { view: true },
        clients: { view: true, create: true },
      }),
    },
  });
  const managerRole = await prisma.workerRole.create({
    data: {
      name: "Gérant",
      permissions: JSON.stringify({
        dashboard: { view: true },
        showroom: { view: true, create: true, edit: true, delete: true },
        purchase: { view: true, create: true },
        pos: { view: true, create: true },
        sales: { view: true, edit: true },
        reports: { view: true },
      }),
    },
  });

  // --- Workers ---
  await prisma.worker.create({
    data: {
      fullName: "Karim Benali",
      phone: "+213661234567",
      roleId: managerRole.id,
      paymentType: "MONTHLY",
      paymentAmount: 60000,
      startDate: new Date("2023-06-01"),
      idCardNumber: "1234567890",
    },
  });
  const worker2 = await prisma.worker.create({
    data: {
      fullName: "Sofiane Meziane",
      phone: "+213662345678",
      roleId: adminRole.id,
      paymentType: "DAILY",
      paymentAmount: 2500,
      startDate: new Date("2024-01-15"),
    },
  });
  await prisma.workerAdvance.create({
    data: { workerId: worker2.id, amount: 10000, description: "Avance sur salaire", date: new Date() },
  });

  // --- Suppliers ---
  const supplier1 = await prisma.supplier.create({
    data: {
      fullName: "Auto Import SARL",
      phone: "+213770112233",
      address: "Zone Industrielle, Rouiba, Alger",
      nif: "099916009988776",
      nis: "000916009988776",
      article: "16009988776",
      rs: "Auto Import SARL",
    },
  });
  const supplier2 = await prisma.supplier.create({
    data: {
      fullName: "Mehdi Larbi",
      phone: "+213771445566",
      address: "Cité 200 logements, Oran",
    },
  });

  // --- Clients ---
  const client1 = await prisma.client.create({
    data: {
      firstName: "Amine",
      lastName: "Haddad",
      phonePrimary: "+213555998877",
      email: "amine.haddad@email.dz",
      address: "Hydra, Alger",
      gender: "M",
      profession: "Médecin",
      docType: "Carte d'Identité",
      docNumber: "109876543",
      docDeliveryAddress: "Daïra de Bir Mourad Raïs",
      docDeliveryDate: new Date("2020-03-10"),
      docExpiry: new Date("2030-03-10"),
    },
  });
  const client2 = await prisma.client.create({
    data: {
      firstName: "Nadia",
      lastName: "Cherif",
      phonePrimary: "+213556334455",
      address: "Bab Ezzouar, Alger",
      gender: "F",
      profession: "Avocate",
      docType: "Permis Biométrique",
      docNumber: "PB445566",
    },
  });

  // --- Cars + Purchases ---
  const carsData = [
    { brand: "Volkswagen", model: "Golf 8 GTI", plate: "00123-119-16", year: 2022, color: "Gris Nardo", energy: "ESSENCE", gearbox: "AUTO", seats: 5, mileage: 18000, vin: "WVWZZZ1KZAW000001", purchasePrice: 4200000, sellingPrice: 4800000, supplierId: supplier1.id },
    { brand: "Mercedes-Benz", model: "Classe C 200", plate: "00456-119-16", year: 2021, color: "Noir Obsidienne", energy: "DIESEL", gearbox: "AUTO", seats: 5, mileage: 32000, vin: "WDD2050461A000002", purchasePrice: 6500000, sellingPrice: 7300000, supplierId: supplier1.id },
    { brand: "Peugeot", model: "208 GT Line", plate: "00789-119-31", year: 2023, color: "Rouge Ultimate", energy: "ESSENCE", gearbox: "MANUAL", seats: 5, mileage: 9000, vin: "VF3CC000000000003", purchasePrice: 2800000, sellingPrice: 3200000, supplierId: supplier2.id },
    { brand: "Toyota", model: "Corolla Hybrid", plate: "01234-120-16", year: 2022, color: "Blanc Nacré", energy: "HYBRID", gearbox: "AUTO", seats: 5, mileage: 21000, vin: "JTDB00000000004", purchasePrice: 3900000, sellingPrice: 4400000, supplierId: supplier1.id },
    { brand: "BMW", model: "Série 3 320i", plate: "01567-120-16", year: 2020, color: "Bleu Portimao", energy: "ESSENCE", gearbox: "AUTO", seats: 5, mileage: 45000, vin: "WBA8E000000000005", purchasePrice: 5800000, sellingPrice: 6500000, supplierId: supplier2.id },
    { brand: "Renault", model: "Clio 5 RS Line", plate: "01890-120-31", year: 2023, color: "Orange Valencia", energy: "ESSENCE", gearbox: "MANUAL", seats: 5, mileage: 5000, vin: "VF1RJ000000000006", purchasePrice: 2500000, sellingPrice: 2900000, supplierId: supplier1.id },
  ];

  const createdCars = [];
  for (let i = 0; i < carsData.length; i++) {
    const c = carsData[i];
    const car = await prisma.car.create({
      data: {
        images: JSON.stringify([]),
        brand: c.brand, model: c.model, plate: c.plate, year: c.year, color: c.color,
        energy: c.energy, gearbox: c.gearbox, seats: c.seats, mileage: c.mileage, vin: c.vin,
        status: "AVAILABLE",
      },
    });
    createdCars.push(car);

    const paid = i % 2 === 0 ? c.purchasePrice : c.purchasePrice - 500000;
    const rest = Math.max(0, c.purchasePrice - paid);
    const purchase = await prisma.purchase.create({
      data: {
        sourceType: "SUPPLIER",
        supplierId: c.supplierId,
        carId: car.id,
        purchasePrice: c.purchasePrice,
        sellingPrice: c.sellingPrice,
        amountPaid: paid,
        amountRest: rest,
        date: new Date(Date.now() - (carsData.length - i) * 7 * 24 * 3600 * 1000),
        inspection: JSON.stringify({
          security: [{ label: "Freins", active: true }, { label: "Airbags", active: true }, { label: "Pneus", active: true }],
          equipment: [{ label: "Climatisation", active: true }, { label: "GPS", active: true }],
          comfort: [{ label: "Sièges chauffants", active: true }],
        }),
      },
    });
    await prisma.purchase.update({ where: { id: purchase.id }, data: { reference: makeRef("ACH", purchase.id) } });
    if (paid > 0) {
      await prisma.purchasePayment.create({ data: { purchaseId: purchase.id, amount: paid, description: "Versement initial", date: purchase.date } });
    }

    // website offer row (visible)
    await prisma.websiteOffer.create({ data: { carId: car.id, hidden: false } });

    // some car expenses
    if (i < 3) {
      await prisma.expense.create({ data: { type: "CAR", carId: car.id, name: "Vidange & révision", description: "Entretien complet", amount: 25000, date: new Date() } });
      await prisma.expense.create({ data: { type: "CAR", carId: car.id, name: "Polish carrosserie", amount: 15000, date: new Date() } });
    }
  }

  // --- A sale (first car sold to client1) ---
  const soldCar = createdCars[0];
  const sale = await prisma.sale.create({
    data: {
      carId: soldCar.id,
      clientId: client1.id,
      saleType: "NORMAL",
      tvaEnabled: true,
      tvaRate: 19,
      reductionType: "NONE",
      totalBeforeTax: 4800000,
      totalAfterTax: Math.round(4800000 * 1.19),
      totalAfterReduction: Math.round(4800000 * 1.19),
      amountPaid: 4000000,
      amountRest: Math.round(4800000 * 1.19) - 4000000,
      clientTakeCar: false,
      date: new Date(),
      inspection: JSON.stringify({
        security: [{ label: "Freins", active: true }, { label: "Airbags", active: true }],
        equipment: [{ label: "Climatisation", active: true }],
        comfort: [{ label: "Toit ouvrant", active: true }],
      }),
    },
  });
  await prisma.sale.update({ where: { id: sale.id }, data: { reference: makeRef("VNT", sale.id) } });
  await prisma.salePayment.create({ data: { saleId: sale.id, amount: 4000000, description: "Acompte initial", date: new Date() } });
  await prisma.car.update({ where: { id: soldCar.id }, data: { status: "SOLD" } });

  // --- A reserved car (deposit) ---
  const reservedCar = createdCars[1];
  const depositSale = await prisma.sale.create({
    data: {
      carId: reservedCar.id,
      clientId: client2.id,
      saleType: "DEPOSIT",
      totalBeforeTax: 7300000,
      totalAfterTax: 7300000,
      totalAfterReduction: 7300000,
      amountPaid: 1000000,
      amountRest: 6300000,
      clientTakeCar: false,
      date: new Date(),
      inspection: JSON.stringify({ security: [], equipment: [], comfort: [] }),
    },
  });
  await prisma.sale.update({ where: { id: depositSale.id }, data: { reference: makeRef("VNT", depositSale.id) } });
  await prisma.salePayment.create({ data: { saleId: depositSale.id, amount: 1000000, description: "Acompte réservation", date: new Date() } });
  await prisma.car.update({ where: { id: reservedCar.id }, data: { status: "RESERVED" } });

  // --- Showroom expenses ---
  await prisma.expense.create({ data: { type: "SHOWROOM", name: "Loyer mensuel", description: "Loyer du local", amount: 120000, date: new Date() } });
  await prisma.expense.create({ data: { type: "SHOWROOM", name: "Électricité", amount: 18000, date: new Date() } });
  await prisma.expense.create({ data: { type: "SHOWROOM", name: "Publicité Facebook", description: "Campagne du mois", amount: 35000, date: new Date() } });

  // --- A website reservation (pending) ---
  await prisma.websiteReservation.create({
    data: { carId: createdCars[2].id, clientName: "Yacine Touati", clientPhone: "+213557889900", status: "PENDING" },
  });

  // --- A special offer ---
  await prisma.websiteOffer.update({
    where: { carId: createdCars[5].id },
    data: { isSpecial: true, specialPrice: 2700000, startDate: new Date(), endDate: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
  });

  console.log("✅ Seed complete!");
  console.log("   Demo login → email: demo@showroom.dz | password: demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
