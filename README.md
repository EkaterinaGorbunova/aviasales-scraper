
Install Dependencies
```bash
npm init -y
npm install axios @prisma/client
npm install --save-dev prisma typescript ts-node @types/node
npx tsc --init
```

Create Prisma & SQLite

```bash
npx prisma init --datasource-provider sqlite
```
This will create `prisma/schema.prisma file`. Replace its contents with:

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model Ticket {
  id           Int    @id @default(autoincrement())
  airline      String
  departureAt  String
  price        Int
}
```

Generate a Prisma Client and create a database
```bash
npx prisma generate
npx prisma db push
```

GraphQL:

```GraphQL
{
  prices_round_trip(
    params: {
      origin: "YMQ"
      destination: "YVR"
      depart_date_min: "2025-07-25"
      depart_date_max: "2025-07-29"
      return_date_min: "2025-08-07"
      return_date_max: "2025-08-11"
      no_lowcost: true
    }
    paging: {
      limit: 5
      offset: 0
    }
    sorting: VALUE_ASC
    currency: "cad"
  ) {
    departure_at
    return_at
    value  # price for round trip
    trip_duration
    ticket_link
    segments {
      flight_legs {
        aircraft_code
        flight_number
        origin
        destination
        departure_at
        arrival_at
      }
    }
  }
}
```

