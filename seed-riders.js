require("dotenv").config({ quiet: true });

const { MongoClient } = require("mongodb");

const districts = [
    "Bagerhat",
    "Bandarban",
    "Barguna",
    "Barishal",
    "Bhola",
    "Bogura",
    "Brahmanbaria",
    "Chandpur",
    "Chapainawabganj",
    "Chattogram",
    "Chuadanga",
    "Cox's Bazar",
    "Cumilla",
    "Dhaka",
    "Dinajpur",
    "Faridpur",
    "Feni",
    "Gaibandha",
    "Gazipur",
    "Gopalganj",
    "Habiganj",
    "Jamalpur",
    "Jashore",
    "Jhalokati",
    "Jhenaidah",
    "Joypurhat",
    "Khagrachhari",
    "Khulna",
    "Kishoreganj",
    "Kurigram",
    "Kushtia",
    "Lakshmipur",
    "Lalmonirhat",
    "Madaripur",
    "Magura",
    "Manikganj",
    "Meherpur",
    "Moulvibazar",
    "Munshiganj",
    "Mymensingh",
    "Naogaon",
    "Narail",
    "Narayanganj",
    "Narsingdi",
    "Natore",
    "Netrokona",
    "Nilphamari",
    "Noakhali",
    "Pabna",
    "Panchagarh",
    "Patuakhali",
    "Pirojpur",
    "Rajbari",
    "Rajshahi",
    "Rangamati",
    "Rangpur",
    "Satkhira",
    "Shariatpur",
    "Sherpur",
    "Sirajganj",
    "Sunamganj",
    "Sylhet",
    "Tangail",
    "Thakurgaon",
];

const divisionsByDistrict = {
    Bagerhat: "Khulna",
    Bandarban: "Chattogram",
    Barguna: "Barishal",
    Barishal: "Barishal",
    Bhola: "Barishal",
    Bogura: "Rajshahi",
    Brahmanbaria: "Chattogram",
    Chandpur: "Chattogram",
    Chapainawabganj: "Rajshahi",
    Chattogram: "Chattogram",
    Chuadanga: "Khulna",
    "Cox's Bazar": "Chattogram",
    Cumilla: "Chattogram",
    Dhaka: "Dhaka",
    Dinajpur: "Rangpur",
    Faridpur: "Dhaka",
    Feni: "Chattogram",
    Gaibandha: "Rangpur",
    Gazipur: "Dhaka",
    Gopalganj: "Dhaka",
    Habiganj: "Sylhet",
    Jamalpur: "Mymensingh",
    Jashore: "Khulna",
    Jhalokati: "Barishal",
    Jhenaidah: "Khulna",
    Joypurhat: "Rajshahi",
    Khagrachhari: "Chattogram",
    Khulna: "Khulna",
    Kishoreganj: "Dhaka",
    Kurigram: "Rangpur",
    Kushtia: "Khulna",
    Lakshmipur: "Chattogram",
    Lalmonirhat: "Rangpur",
    Madaripur: "Dhaka",
    Magura: "Khulna",
    Manikganj: "Dhaka",
    Meherpur: "Khulna",
    Moulvibazar: "Sylhet",
    Munshiganj: "Dhaka",
    Mymensingh: "Mymensingh",
    Naogaon: "Rajshahi",
    Narail: "Khulna",
    Narayanganj: "Dhaka",
    Narsingdi: "Dhaka",
    Natore: "Rajshahi",
    Netrokona: "Mymensingh",
    Nilphamari: "Rangpur",
    Noakhali: "Chattogram",
    Pabna: "Rajshahi",
    Panchagarh: "Rangpur",
    Patuakhali: "Barishal",
    Pirojpur: "Barishal",
    Rajbari: "Dhaka",
    Rajshahi: "Rajshahi",
    Rangamati: "Chattogram",
    Rangpur: "Rangpur",
    Satkhira: "Khulna",
    Shariatpur: "Dhaka",
    Sherpur: "Mymensingh",
    Sirajganj: "Rajshahi",
    Sunamganj: "Sylhet",
    Sylhet: "Sylhet",
    Tangail: "Dhaka",
    Thakurgaon: "Rangpur",
};

const slugify = (value) =>
    value
        .toLowerCase()
        .replace(/'/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

const riders = districts.map((district, index) => {
    const number = String(index + 1).padStart(2, "0");
    const slug = slugify(district);

    return {
        name: `Rider ${district}`,
        email: `rider.${slug}@zapshift.com`,
        phone: `0170000${number.padStart(4, "0")}`,
        age: 25 + (index % 12),
        district,
        division: divisionsByDistrict[district],
        region: divisionsByDistrict[district],
        vehicleType: "motorbike",
        nid: `1990${String(index + 1).padStart(10, "0")}`,
        status: "active",
        currentAssignedParcels: 0,
        currentAssignedDeliveries: 0,
        completedDeliveries: 0,
        joinedAt: new Date(),
        created_At: new Date(),
        seeded: true,
        seedKey: `bd-district-rider-${slug}`,
    };
});

if (process.argv.includes("--json")) {
    console.log(JSON.stringify(riders, null, 2));
    return;
}

async function main() {
    if (!process.env.DB_USERNAME || !process.env.DB_PASSWORD) {
        throw new Error("DB_USERNAME and DB_PASSWORD are required in .env");
    }

    const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.7hhwads.mongodb.net/?appName=Cluster0`;
    const client = new MongoClient(uri);

    await client.connect();

    const riderCollection = client.db("zap_shift-user_db").collection("riders");

    const operations = riders.map((rider) => ({
        updateOne: {
            filter: { email: rider.email },
            update: {
                $setOnInsert: rider,
                $set: {
                    district: rider.district,
                    division: rider.division,
                    region: rider.region,
                    status: "active",
                },
            },
            upsert: true,
        },
    }));

    const result = await riderCollection.bulkWrite(operations, { ordered: false });
    const seededDistrictCount = await riderCollection.countDocuments({ seeded: true });

    console.log(
        JSON.stringify(
            {
                matched: result.matchedCount,
                inserted: result.upsertedCount,
                modified: result.modifiedCount,
                seededDistrictRidersInDatabase: seededDistrictCount,
            },
            null,
            2
        )
    );

    await client.close();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
