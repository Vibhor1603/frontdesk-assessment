import { supabase } from "../src/core/db/supabase.js";
import dotenv from "dotenv";

dotenv.config();

async function checkGoogleCalendar() {// Check environment variables// Check if table existstry {
    const { data: tables, error: tableError } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .limit(1);

    if (tableError) {
      if (tableError.code === "42P01") {} else {}
    } else {}
  } catch (error) {}

  // Check for tokenstry {
    const { data, error } = await supabase
      .from("google_calendar_tokens")
      .select("*");

    if (error) {} else if (!data || data.length === 0) {} else {}
  } catch (error) {}

  // Check googleapis packagetry {
    await import("googleapis");} catch (error) {}););

  const hasClientId = !!process.env.GOOGLE_CLIENT_ID;
  const hasClientSecret = !!process.env.GOOGLE_CLIENT_SECRET;

  if (!hasClientId || !hasClientSecret) {} else {");}
}

checkGoogleCalendar();
